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
 * Ingatan singkat: userId Privy -> alamat wallet.
 *
 * Tanpa ini, SETIAP request yang butuh login memanggil API Privy lewat jaringan
 * hanya untuk menanyakan hal yang sama berulang kali. Itu memperlambat semua
 * request, dan siapa pun yang membanjiri satu endpoint bisa menghabiskan jatah
 * API Privy kita sampai user asli ikut terkunci.
 *
 * Kuncinya userId dari token yang SUDAH diverifikasi secara kriptografis,
 * jadi tidak ada nilai dari browser yang bisa menyentuh cache ini.
 *
 * Umurnya sengaja pendek: kalau user mengganti wallet di Privy, perubahannya
 * ikut terbaca paling lama setelah TTL ini lewat.
 */
const WALLET_CACHE_TTL_MS = 5 * 60 * 1000;
const WALLET_CACHE_MAX_ENTRIES = 5_000;

const walletCache = new Map<string, { walletAddress: string; expiresAt: number }>();

function getCachedWallet(userId: string): string | null {
  const hit = walletCache.get(userId);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    walletCache.delete(userId);
    return null;
  }
  return hit.walletAddress;
}

function cacheWallet(userId: string, walletAddress: string) {
  // Map mengingat urutan penyisipan, jadi entri terlama ada di depan.
  if (walletCache.size >= WALLET_CACHE_MAX_ENTRIES) {
    const oldest = walletCache.keys().next().value;
    if (oldest !== undefined) walletCache.delete(oldest);
  }
  walletCache.set(userId, { walletAddress, expiresAt: Date.now() + WALLET_CACHE_TTL_MS });
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

  // Sudah pernah ditanyakan baru-baru ini? Lewati panggilan jaringan ke Privy.
  const cached = getCachedWallet(userId);
  if (cached) return { ok: true, user: { userId, walletAddress: cached } };

  try {
    const user = await privy.users()._get(userId);
    const walletAddress = findSolanaWallet(user.linked_accounts);
    // Kegagalan sengaja TIDAK di-cache: user yang baru menghubungkan wallet
    // tidak perlu menunggu TTL habis dulu.
    if (!walletAddress) return deny(403, "No Solana wallet linked to this account");

    cacheWallet(userId, walletAddress);
    return { ok: true, user: { userId, walletAddress } };
  } catch (error) {
    console.error("[privy-server] Failed to load Privy user", error);
    return deny(500, "Could not load user");
  }
}
