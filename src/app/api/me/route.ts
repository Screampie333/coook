import { NextResponse } from "next/server";
import { requireUser } from "@/lib/privy-server";

/**
 * GET /api/me
 * Mengembalikan alamat wallet user yang login, hasil verifikasi server.
 * 401 kalau belum login atau token tidak valid.
 */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    { userId: auth.user.userId, walletAddress: auth.user.walletAddress },
    { headers: { "Cache-Control": "no-store" } },
  );
}
