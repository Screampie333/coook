"use client";

import { getAccessToken, type PrivyErrorCode, type User } from "@privy-io/react-auth";
import { useSyncExternalStore } from "react";

/**
 * Alamat wallet Solana user yang login, hanya untuk DITAMPILKAN di browser.
 * Server tidak pernah memakai nilai ini; server mengambilnya sendiri dari Privy.
 */
export function getSolanaAddress(user: User | null): string | null {
  if (!user) return null;
  for (const account of user.linkedAccounts) {
    if (account.type === "wallet" && account.chainType === "solana") {
      return account.address;
    }
  }
  return null;
}

/**
 * fetch yang otomatis menyertakan access token Privy di header Authorization.
 * Pakai ini untuk memanggil API route yang butuh login.
 * getAccessToken juga me-refresh token yang hampir kedaluwarsa (lihat docs Privy: access tokens).
 * Hanya bisa dipakai di komponen yang berada di dalam PrivyProvider.
 */
export async function authFetch(input: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

type PhantomWindow = Window & { phantom?: { solana?: { isPhantom?: boolean } } };

const noopSubscribe = () => () => {};

/**
 * Cek apakah ekstensi Phantom terpasang.
 * Cara deteksi sesuai docs Phantom: window.phantom?.solana?.isPhantom
 */
export function usePhantomInstalled() {
  return useSyncExternalStore(
    noopSubscribe,
    () => Boolean((window as PhantomWindow).phantom?.solana?.isPhantom),
    // Saat render di server kita belum tahu, jadi anggap terpasang (tidak menampilkan peringatan).
    () => true,
  );
}

/**
 * Mengubah kode error login Privy jadi pesan yang jelas.
 * null = tidak perlu menampilkan apa-apa (misalnya user menutup modal).
 */
// PrivyErrorCode hanya ada sebagai tipe (tidak diekspor saat runtime),
// jadi kita bandingkan dengan nilai string-nya langsung.
export function loginErrorMessage(code: PrivyErrorCode): string | null {
  switch (`${code}`) {
    case "exited_auth_flow":
      return null;
    case "generic_connect_wallet_error":
    case "unknown_connect_wallet_error":
    case "unable_to_sign":
      return "Signature rejected in your wallet. Try again.";
    case "client_request_timeout":
      return "Your wallet didn't respond. Try again.";
    case "too_many_requests":
      return "Too many attempts. Wait a moment and try again.";
    case "disallowed_login_method":
      return "This login method isn't allowed. Use a Solana wallet.";
    default:
      return "Couldn't connect your wallet. Try again.";
  }
}
