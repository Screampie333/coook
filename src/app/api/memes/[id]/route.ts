import { NextResponse } from "next/server";
import { z } from "zod";
import { aiErrorResponse, errorResponse } from "@/lib/cook/api-errors";
import { CAPTION_COUNT } from "@/lib/cook/limits";
import { setCaptionIndex } from "@/lib/db/memes";
import { requireUser } from "@/lib/privy-server";
import { isDatabaseConfigured } from "@/lib/supabase/server";

/**
 * PATCH /api/memes/<id>
 * Body: { "captionIndex": 0 | 1 | 2 | null }
 * Mencatat caption yang dipilih pembuatnya (dipanggil saat Download), untuk ditampilkan di galeri.
 * Hanya pemilik meme yang bisa mengubahnya.
 */

const bodySchema = z.object({
  captionIndex: z.number().int().min(0).max(CAPTION_COUNT - 1).nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  if (!isDatabaseConfigured()) {
    console.error("[api/memes] SUPABASE_URL or SUPABASE_SECRET_KEY is missing.");
    return errorResponse(500, "server_error", "The kitchen isn't set up yet. Try again later.");
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return errorResponse(400, "invalid_input", "That meme id doesn't look right.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_input", "Send the caption choice as JSON.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "invalid_input", "That caption choice doesn't look right.");
  }

  try {
    const updated = await setCaptionIndex(id, auth.user.walletAddress, parsed.data.captionIndex);
    if (!updated) return errorResponse(404, "not_found", "That meme isn't in your kitchen.");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return aiErrorResponse(error, "api/memes");
  }
}
