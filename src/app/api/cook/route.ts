import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError } from "@/lib/ai";
import { aiErrorResponse, errorResponse, ovenOutOfGasResponse } from "@/lib/cook/api-errors";
import { IdeaRejectedError } from "@/lib/cook/errors";
import {
  getImageQuota,
  isImageProviderExhausted,
  markImageProviderExhausted,
  refundImage,
  reserveImage,
} from "@/lib/cook/image-quota";
import { IDEA_MAX_LENGTH, IMAGE_DAILY_LIMIT, normalizeIdea } from "@/lib/cook/limits";
import { cookMeme } from "@/lib/cook/meme";
import { getLore, type Lore } from "@/lib/lore";
import { requireUser } from "@/lib/privy-server";

/**
 * POST /api/cook
 * Body: { "idea": "...", "loreId": "coook" | null }
 * Hasil: {
 *   "picture": "data:image/jpeg;base64,...",   ← gambar tanpa caption
 *   "captions": ["...", "...", "..."],         ← ditempel di browser kalau user memilihnya
 *   "quota": {...}
 * }
 * Error: { "error": "pesan untuk user", "code": "...", "quota"?: {...}, "resetsAt"?: "...", "retryAfterSeconds"?: number }
 *
 * Urutan: adegan (Groq) → gambar (Cloudflare) → 3 caption (Groq).
 */

// Adegan + gambar (timeout 30 detik) + caption.
export const maxDuration = 60;

const bodySchema = z.object({
  idea: z
    .string("Type an idea first.")
    .transform(normalizeIdea)
    .pipe(
      z
        .string()
        .min(1, "Type an idea first.")
        .max(IDEA_MAX_LENGTH, `Keep your idea under ${IDEA_MAX_LENGTH} characters.`),
    ),
  /** Kosong/null = meme bebas tanpa lore. Isi lore selalu diambil server dari file, bukan dari browser. */
  loreId: z.string("Pick a lore from the list.").max(64).nullish(),
});

export async function POST(request: Request) {
  // 1. Wajib login. Wallet diambil dari data Privy yang terverifikasi.
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const wallet = auth.user.walletAddress;

  // 2. Validasi input.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_input", "Send your idea as JSON.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "That idea doesn't look right.";
    return errorResponse(400, "invalid_input", message);
  }

  let lore: Lore | null = null;
  if (parsed.data.loreId) {
    lore = getLore(parsed.data.loreId);
    if (!lore) {
      return errorResponse(400, "unknown_lore", "That lore isn't on the menu anymore. Pick another one.");
    }
  }

  // 3. Kuota gambar gratis hari ini sudah habis? Tolak langsung tanpa memakai token AI teks.
  if (isImageProviderExhausted()) {
    return ovenOutOfGasResponse({ quota: getImageQuota(wallet) });
  }

  // 4. Potong jatah harian wallet (sementara disimpan di memori server).
  const reserved = reserveImage(wallet);
  if (!reserved.ok) {
    return errorResponse(
      429,
      "daily_limit",
      `You've cooked ${IMAGE_DAILY_LIMIT} memes today. Come back after the daily reset.`,
      { quota: reserved.quota, resetsAt: reserved.quota.resetsAt },
    );
  }

  // 5. Masak meme. Kalau langkah mana pun gagal, jatahnya dikembalikan.
  try {
    const { picture, captions } = await cookMeme(parsed.data.idea, lore);
    return NextResponse.json(
      {
        picture: `data:${picture.mimeType};base64,${picture.data.toString("base64")}`,
        captions,
        quota: reserved.quota,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const quota = refundImage(reserved.reservation);

    if (error instanceof IdeaRejectedError) {
      return errorResponse(422, "idea_rejected", "Can't cook that idea. Try a different one.", { quota });
    }
    // Saat ini hanya provider gambar (Cloudflare) yang punya kuota harian.
    if (error instanceof AiError && error.code === "quota_exhausted") {
      markImageProviderExhausted();
    }
    return aiErrorResponse(error, "api/cook", { quota });
  }
}
