import { NextResponse } from "next/server";
import { z } from "zod";
import { aiErrorResponse, errorResponse } from "@/lib/cook/api-errors";
import { isCaptionTokenConfigured, verifyCaptionToken } from "@/lib/cook/caption-token";
import { refundImage, reserveImage } from "@/lib/cook/image-quota";
import { CAPTION_COUNT, IMAGE_DAILY_LIMIT } from "@/lib/cook/limits";
import { cookMemeImage } from "@/lib/cook/meme";
import { requireUser } from "@/lib/privy-server";

/**
 * POST /api/cook/image
 * Body: { "captionToken": "...", "captionIndex": 0 }
 * Hasil: { "image": "data:image/jpeg;base64,...", "caption": "...", "quota": {...} }
 * Error: { "error": "pesan untuk user", "code": "...", "quota"?: {...}, "resetsAt"?: "..." }
 *
 * Teks caption diambil dari captionToken yang ditandatangani server, bukan dari browser.
 */

// Adegan (Groq) + gambar (Cloudflare, timeout 30 detik) + tempel caption.
export const maxDuration = 60;

const bodySchema = z.object({
  captionToken: z.string("Cook some captions first.").min(1, "Cook some captions first.").max(8000),
  captionIndex: z
    .number("Pick a caption first.")
    .int("Pick a caption first.")
    .min(0, "Pick a caption first.")
    .max(CAPTION_COUNT - 1, "Pick a caption first."),
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
    return errorResponse(400, "invalid_input", "Pick a caption first.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "invalid_input", parsed.error.issues[0]?.message ?? "Pick a caption first.");
  }

  // 3. Periksa token caption.
  if (!isCaptionTokenConfigured()) {
    console.error("[api/cook/image] COOK_SIGNING_SECRET is missing or shorter than 32 characters.");
    return errorResponse(500, "server_error", "The kitchen isn't set up yet. Try again later.");
  }

  const verified = verifyCaptionToken(parsed.data.captionToken, wallet);
  if (!verified.ok) {
    switch (verified.reason) {
      case "expired":
        return errorResponse(400, "captions_expired", "These captions went stale. Cook new ones.");
      case "wrong_wallet":
        return errorResponse(403, "wrong_wallet", "These captions belong to another wallet. Cook new ones.");
      default:
        return errorResponse(400, "invalid_captions", "Those captions don't look right. Cook new ones.");
    }
  }

  const { idea, captions } = verified.payload;
  const caption = captions[parsed.data.captionIndex];

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

  // 5. Masak meme. Kalau gagal, jatahnya dikembalikan.
  try {
    const meme = await cookMemeImage({ idea, caption });
    return NextResponse.json(
      {
        image: `data:image/jpeg;base64,${meme.toString("base64")}`,
        caption,
        quota: reserved.quota,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const quota = refundImage(reserved.reservation);
    return aiErrorResponse(error, "api/cook/image", { quota });
  }
}
