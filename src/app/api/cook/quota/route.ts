import { NextResponse } from "next/server";
import { aiErrorResponse, errorResponse } from "@/lib/cook/api-errors";
import { getImageQuota } from "@/lib/db/usage";
import { ensureUser } from "@/lib/db/users";
import { requireUser } from "@/lib/privy-server";
import { isDatabaseConfigured } from "@/lib/supabase/server";

/**
 * GET /api/cook/quota
 * Sisa jatah gambar meme wallet yang login hari ini.
 * Sekaligus mendaftarkan user (baris di tabel users) saat pertama kali login.
 */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  if (!isDatabaseConfigured()) {
    console.error("[api/cook/quota] SUPABASE_URL or SUPABASE_SECRET_KEY is missing.");
    return errorResponse(500, "server_error", "The kitchen isn't set up yet. Try again later.");
  }

  try {
    await ensureUser(auth.user.walletAddress, auth.user.userId);
    const quota = await getImageQuota(auth.user.walletAddress);
    return NextResponse.json(quota, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return aiErrorResponse(error, "api/cook/quota");
  }
}
