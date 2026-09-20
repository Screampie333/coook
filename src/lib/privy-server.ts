import "server-only";

import { PrivyClient, type LinkedAccount } from "@privy-io/node";
import { NextResponse } from "next/server";

/**
 * Helper login untuk API route.
 * File ini hanya boleh dipakai di server (dijaga oleh import "server-only").
 *
 * Alur:
 * 1. Ambil access token dari header Authorization (TIDAK PERNAH dari cookie, lihat getAccessToken).
 * 2. Verifikasi token dengan Privy -> dapat user_id yang terpercaya.
 * 3. Ambil data user dari Privy memakai PRIVY_APP_SECRET.
 * 4. Cari wallet Solana eksternal milik user itu.
 * Alamat wallet TIDAK PERNAH diambil dari input browser.
 */

let client: PrivyClient | null = null;

function getPrivyClient() {
  if (client) return client;

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Privy is not configured: NEXT_PUBLIC_PRIVY_APP_ID or PRIVY_APP_SECRET is missing.");
  }

  // Dibuat sekali lalu dipakai ulang (kunci verifikasi ikut di-cache).
  client = new PrivyClient({ appId, appSecret });
  return client;
}

export type AuthedUser = {
  /** Privy DID, contoh: did:privy:xxxx */
  userId: string;
  /** Alamat wallet Solana eksternal yang terhubung ke user ini. */
  walletAddress: string;
};

export type AuthResult =
  | { ok: true; user: AuthedUser }
  | { ok: false; response: NextResponse };

/**
 * Token HANYA diterima dari header Authorization, tidak pernah dari cookie.
 *
 * Ini yang menutup CSRF. Privy ikut menulis cookie berisi token yang sama, dan
 * browser mengirim cookie otomatis ke mana pun — termasuk saat situs jahat
 * memanggil API kita dari halaman mereka. Kalau server menerima token dari cookie,
 * situs itu bisa menjalankan aksi atas nama user yang sedang login: menghabiskan
 * jatah meme hariannya, atau memicu pembuatan koin yang menulis permanen ke IPFS.
 *
 * Header Authorization tidak bisa dipasang oleh situs lain pada permintaan lintas
 * situs tanpa izin CORS dari kita, dan isinya tidak bisa dibaca dari halaman kita.
 * Jadi selama token hanya datang dari header, serangan itu tidak jalan.
 *
 * Catatan: jangan tergoda menambahkan pembacaan cookie "sebagai cadangan".
 * Seluruh kode browser sudah memakai authFetch(), yang selalu memasang header ini.
 */
function getAccessToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

function findSolanaWallet(accounts: LinkedAccount[]): string | null {
  for (const account of accounts) {
    if (
      account.type === "wallet" &&
      "chain_type" in account &&
      account.chain_type === "solana" &&
      // Hanya wallet eksternal (Phantom, Solflare, Backpack), bukan embedded wallet.
      !("connector_type" in account && account.connector_type === "embedded")
    ) {
      return account.address;
    }
  }
  return null;
}

function deny(status: 401 | 403 | 500, error: string): AuthResult {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/**
 * Pakai di awal setiap API route yang butuh login:
 *
 *   const auth = await requireUser(request);
 *   if (!auth.ok) return auth.response;
 *   auth.user.walletAddress // aman dipakai
 */
export async function requireUser(request: Request): Promise<AuthResult> {
  const token = getAccessToken(request);
  if (!token) return deny(401, "Unauthorized");

  let privy: PrivyClient;
  try {
    privy = getPrivyClient();
  } catch (error) {
    console.error("[privy-server]", error);
    return deny(500, "Auth is not configured on the server");
  }

  let userId: string;
  try {
    const claims = await privy.utils().auth().verifyAccessToken(token);
    userId = claims.user_id;
  } catch {
    // Token palsu, kedaluwarsa, atau untuk app lain.
    return deny(401, "Unauthorized");
  }

  try {
    const user = await privy.users()._get(userId);
    const walletAddress = findSolanaWallet(user.linked_accounts);
    if (!walletAddress) return deny(403, "No Solana wallet linked to this account");
    return { ok: true, user: { userId, walletAddress } };
  } catch (error) {
    console.error("[privy-server] Failed to load Privy user", error);
    return deny(500, "Could not load user");
  }
}
