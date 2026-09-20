import { NextResponse } from "next/server";
import { aiErrorResponse, errorResponse } from "@/lib/cook/api-errors";
import { listWalletLaunches } from "@/lib/db/launches";
import { listWalletMemes, MEMES_PAGE_SIZE, parseCursor } from "@/lib/db/memes";
import { requireUser } from "@/lib/privy-server";
import { isDatabaseConfigured } from "@/lib/supabase/server";

/**
 * GET /api/kitchen?before=<waktu ISO>
 * Meme milik wallet yang login + koin yang pernah dia mint.
 * `before` dipakai untuk memuat halaman berikutnya (meme yang lebih lama).
 */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  if (!isDatabaseConfigured()) {
    console.error("[api/kitchen] SUPABASE_URL or SUPABASE_SECRET_KEY is missing.");
    return errorResponse(500, "server_error", "The kitchen isn't set up yet. Try again later.");
  }

  // Penanda halaman datang mentah dari URL, jadi diperiksa dulu.
  const rawBefore = new URL(request.url).searchParams.get("before");
  const before = parseCursor(rawBefore) ?? undefined;
  if (rawBefore !== null && before === undefined) {
    return errorResponse(400, "invalid_input", "That page marker doesn't look right.");
  }

  const wallet = auth.user.walletAddress;

  try {
    // Daftar koin hanya dikirim di halaman pertama.
    const [memes, launches] = await Promise.all([
      listWalletMemes(wallet, { before }),
      before ? Promise.resolve([]) : listWalletLaunches(wallet),
    ]);

    return NextResponse.json(
      { memes, launches, pageSize: MEMES_PAGE_SIZE },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return aiErrorResponse(error, "api/kitchen");
  }
}
