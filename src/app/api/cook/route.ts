import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError } from "@/lib/ai";
import { aiErrorResponse, errorResponse, ovenOutOfGasResponse } from "@/lib/cook/api-errors";
import { IdeaRejectedError } from "@/lib/cook/errors";
import { IDEA_MAX_LENGTH, IMAGE_DAILY_LIMIT, normalizeIdea } from "@/lib/cook/limits";
import { cookMeme } from "@/lib/cook/meme";
import { isImageProviderExhausted, markImageProviderExhausted } from "@/lib/cook/oven-status";
import { insertMeme } from "@/lib/db/memes";
import { deleteMemeImage, memeImagePath, memeImageUrl, uploadMemeImage } from "@/lib/db/storage";
import { getImageQuota, refundImage, reserveImage } from "@/lib/db/usage";
import { ensureUser } from "@/lib/db/users";
import { requireUser } from "@/lib/privy-server";
import { isDatabaseConfigured } from "@/lib/supabase/server";

/**
 * POST /api/cook
 * Body: { "idea": "..." }
 * Hasil: {
 *   "meme": { "id": "...", "imageUrl": "https://...", "captions": ["...", "...", "..."] },
 *   "quota": {...}
 * }
 * Error: { "error": "pesan untuk user", "code": "...", "quota"?: {...}, "resetsAt"?: "...", "retryAfterSeconds"?: number }
 *
 * Urutan: adegan (Groq) → gambar (Cloudflare) → 3 caption (Groq) → simpan ke Storage + tabel memes.
 */

// Adegan + gambar (timeout 30 detik) + caption + upload.
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

  if (!isDatabaseConfigured()) {
    console.error("[api/cook] SUPABASE_URL or SUPABASE_SECRET_KEY is missing.");
    return errorResponse(500, "server_error", "The kitchen isn't set up yet. Try again later.");
  }

  // 3. Siapkan user.
  try {
    await ensureUser(wallet, auth.user.userId);

    // 4. Kuota gambar gratis hari ini sudah habis? Tolak langsung tanpa memakai token AI teks.
    if (isImageProviderExhausted()) {
      return ovenOutOfGasResponse({ quota: await getImageQuota(wallet) });
    }
  } catch (error) {
    return aiErrorResponse(error, "api/cook");
  }

  // 5. Potong jatah harian wallet (atomik di database).
  let reserved;
  try {
    reserved = await reserveImage(wallet);
  } catch (error) {
    return aiErrorResponse(error, "api/cook");
  }

  if (!reserved.ok) {
    return errorResponse(
      429,
      "daily_limit",
      `You've cooked ${IMAGE_DAILY_LIMIT} memes today. Come back after the daily reset.`,
      { quota: reserved.quota, resetsAt: reserved.quota.resetsAt },
    );
  }

  // 6. Masak meme, lalu simpan gambar + barisnya. Kalau ada yang gagal, jatahnya dikembalikan.
  const memeId = randomUUID();
  let uploadedPath: string | null = null;

  try {
    const { picture, captions } = await cookMeme(parsed.data.idea);

    const path = memeImagePath(wallet, memeId, picture.mimeType);
    await uploadMemeImage(path, picture.data, picture.mimeType);
    uploadedPath = path;

    await insertMeme({
      id: memeId,
      walletAddress: wallet,
      idea: parsed.data.idea,
      imagePath: path,
      captions,
    });

    return NextResponse.json(
      {
        meme: { id: memeId, imageUrl: memeImageUrl(path), captions },
        quota: reserved.quota,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Gambar yang sudah ter-upload tapi barisnya gagal disimpan tidak ditinggalkan di Storage.
    if (uploadedPath) await deleteMemeImage(uploadedPath);
    const quota = (await refundImage(reserved.reservation)) ?? undefined;

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
