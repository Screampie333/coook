import { NextResponse } from "next/server";
import { z } from "zod";
import { aiErrorResponse, errorResponse } from "@/lib/cook/api-errors";
import { createCaptionToken, isCaptionTokenConfigured } from "@/lib/cook/caption-token";
import { cookCaptions, IdeaRejectedError } from "@/lib/cook/captions";
import { IDEA_MAX_LENGTH, normalizeIdea } from "@/lib/cook/limits";
import { requireUser } from "@/lib/privy-server";

/**
 * POST /api/cook/captions
 * Body: { "idea": "..." }
 * Hasil: { "captions": ["...", "...", "..."], "captionToken": "..." }
 * Error: { "error": "pesan untuk user", "code": "...", "retryAfterSeconds"?: number }
 *
 * captionToken dipakai untuk membuat gambar (POST /api/cook/image), lihat src/lib/cook/caption-token.ts.
 */

// Batas waktu fungsi di Vercel: 2 percobaan x timeout 20 detik masih muat.
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
  // 1. Wajib login. Token diverifikasi di server (lihat src/lib/privy-server.ts).
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

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

  // 3. Pastikan server siap SEBELUM memakai kuota AI.
  if (!isCaptionTokenConfigured()) {
    console.error("[api/cook/captions] COOK_SIGNING_SECRET is missing or shorter than 32 characters.");
    return errorResponse(500, "server_error", "The kitchen isn't set up yet. Try again later.");
  }

  // 4. Masak caption.
  try {
    const captions = await cookCaptions(parsed.data.idea);
    const captionToken = createCaptionToken({
      wallet: auth.user.walletAddress,
      idea: parsed.data.idea,
      captions,
    });
    return NextResponse.json({ captions, captionToken }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof IdeaRejectedError) {
      return errorResponse(422, "idea_rejected", "Can't cook that idea. Try a different one.");
    }
    return aiErrorResponse(error, "api/cook/captions");
  }
}
