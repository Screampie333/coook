import { LAUNCH } from "@/config/launch";
import type { Cluster } from "./types";

/**
 * Link ke halaman koin dan ke explorer.
 * File ini tidak memakai apa pun dari server, jadi aman dipakai di browser juga.
 */

/** Halaman koin. Token latihan devnet tidak ada di pump.fun, jadi diarahkan ke explorer. */
export function coinUrl(mintAddress: string, cluster: Cluster) {
  if (cluster === "devnet") return explorerAddressUrl(mintAddress, cluster);
  return `${LAUNCH.coinPageUrl}${mintAddress}`;
}

export function explorerAddressUrl(address: string, cluster: Cluster) {
  return `https://solscan.io/account/${address}${cluster === "devnet" ? "?cluster=devnet" : ""}`;
}

export function explorerTransactionUrl(signature: string, cluster: Cluster) {
  return `https://solscan.io/tx/${signature}${cluster === "devnet" ? "?cluster=devnet" : ""}`;
}
