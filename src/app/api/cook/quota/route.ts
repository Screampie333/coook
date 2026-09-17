import { NextResponse } from "next/server";
import { getImageQuota } from "@/lib/cook/image-quota";
import { requireUser } from "@/lib/privy-server";

/**
 * GET /api/cook/quota
 * Sisa jatah gambar meme wallet yang login hari ini.
 * Hasil: { "used": 1, "limit": 5, "remaining": 4, "resetsAt": "2026-09-18T00:00:00.000Z" }
 */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json(getImageQuota(auth.user.walletAddress), {
    headers: { "Cache-Control": "no-store" },
  });
}
