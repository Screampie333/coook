import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError } from "@/lib/ai";
import { cookCaptions, IdeaRejectedError } from "@/lib/cook/captions";
import { IDEA_MAX_LENGTH, normalizeIdea } from "@/lib/cook/limits";
import { requireUser } from "@/lib/privy-server";

/**
 * POST /api/cook/captions
 * Body: { "idea": "..." }
 * Hasil: { "captions": ["...", "...", "..."] }
 * Error: { "error": "pesan untuk user", "code": "...", "retryAfterSeconds"?: number }
 */

// Batas waktu fungsi di Vercel: 2 percobaan x timeout 20 detik masih muat.
export const maxDuration = 60;

const RATE_LIMIT_MESSAGE = "The kitchen is packed right now. Try again in a moment.";

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

  // 3. Masak caption.
  try {
    const captions = await cookCaptions(parsed.data.idea);
    return NextResponse.json({ captions }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return cookErrorResponse(error);
  }
}

function cookErrorResponse(error: unknown) {
  if (error instanceof IdeaRejectedError) {
    return errorResponse(422, "idea_rejected", "Can't cook that idea. Try a different one.");
  }

  if (error instanceof AiError) {
    if (error.code === "rate_limited") {
      const retryAfter = error.retryAfterSeconds;
      return NextResponse.json(
        { error: RATE_LIMIT_MESSAGE, code: "rate_limited", retryAfterSeconds: retryAfter ?? null },
        {
          status: 429,
          headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
        },
      );
    }

    // Detail teknis hanya dicatat di log server, tidak dikirim ke browser.
    console.error(`[api/cook/captions] ${error.code}: ${error.message}`);

    switch (error.code) {
      case "timeout":
        return errorResponse(504, "ai_timeout", "The stove is taking too long. Try again.");
      case "unavailable":
        return errorResponse(503, "ai_unavailable", "The kitchen is closed for a moment. Try again soon.");
      case "config":
        return errorResponse(500, "server_error", "The kitchen isn't set up yet. Try again later.");
      default:
        return errorResponse(502, "ai_failed", "The kitchen burned that one. Try again.");
    }
  }

  console.error("[api/cook/captions] unexpected error", error);
  return errorResponse(500, "server_error", "Something went wrong. Try again.");
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: message, code }, { status });
}
