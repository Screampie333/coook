import { authFetch } from "@/components/auth/hooks";

/**
 * Panggilan ke /api/serve dari browser.
 *
 * Alurnya tiga langkah:
 * 1. prepareCoin()  → server menyiapkan transaksi
 * 2. user tanda tangan di wallet sendiri (dilakukan komponen, pakai hook Privy)
 * 3. confirmCoin()  → server menyiarkan transaksinya ke Solana
 *
 * Fungsi di sini tidak pernah melempar error; semuanya mengembalikan { ok: false, message }.
 */

export type CoinCluster = "mainnet" | "devnet";

export type PreparedCoin = {
  mintAddress: string;
  name: string;
  ticker: string;
  cluster: CoinCluster;
  /** false = token latihan di devnet, bukan koin pump.fun sungguhan. */
  isReal: boolean;
  /** Transaksi base64 yang sudah ditandatangani mint, tinggal ditandatangani user. */
  transaction: string;
  /** Perkiraan SOL yang akan keluar dari wallet user. */
  costSol: number;
  /** Gambar koin yang sudah di-upload ke IPFS. */
  imageUrl: string;
};

export type ConfirmedCoin = {
  mintAddress: string;
  name: string;
  ticker: string;
  cluster: CoinCluster;
  isReal: boolean;
  /** Halaman koin: pump.fun untuk mainnet, explorer untuk devnet. */
  url: string;
  signature: string;
  explorerUrl: string;
};

export type ServeResult<T> = { ok: true; data: T } | { ok: false; message: string };

export type CoinDraft = {
  memeId: string;
  name: string;
  ticker: string;
  description: string;
  caption: string;
};

export async function prepareCoin(draft: CoinDraft): Promise<ServeResult<PreparedCoin>> {
  return post("/api/serve/prepare", draft, (body) => {
    const coin = body.coin as Record<string, unknown> | undefined;
    if (!coin || typeof coin.mintAddress !== "string" || typeof body.transaction !== "string") return null;

    return {
      mintAddress: coin.mintAddress,
      name: String(coin.name ?? ""),
      ticker: String(coin.ticker ?? ""),
      cluster: coin.cluster === "devnet" ? "devnet" : "mainnet",
      isReal: coin.isReal !== false,
      transaction: body.transaction,
      costSol: typeof body.costSol === "number" ? body.costSol : 0,
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : "",
    };
  });
}

export async function confirmCoin(mintAddress: string, transaction: string): Promise<ServeResult<ConfirmedCoin>> {
  return post("/api/serve/confirm", { mintAddress, transaction }, (body) => {
    const coin = body.coin as Record<string, unknown> | undefined;
    if (!coin || typeof coin.mintAddress !== "string" || typeof body.signature !== "string") return null;

    return {
      mintAddress: coin.mintAddress,
      name: String(coin.name ?? ""),
      ticker: String(coin.ticker ?? ""),
      cluster: coin.cluster === "devnet" ? "devnet" : "mainnet",
      isReal: coin.isReal !== false,
      url: String(coin.url ?? ""),
      signature: body.signature,
      explorerUrl: typeof body.explorerUrl === "string" ? body.explorerUrl : "",
    };
  });
}

async function post<T>(
  url: string,
  payload: unknown,
  read: (body: Record<string, unknown>) => T | null,
): Promise<ServeResult<T>> {
  let response: Response;
  try {
    response = await authFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, message: "Couldn't reach the kitchen. Check your connection and try again." };
  }

  const body = ((await response.json().catch(() => null)) ?? {}) as Record<string, unknown>;

  if (response.status === 401) {
    return { ok: false, message: "Your session expired. Connect your wallet again." };
  }
  if (!response.ok) {
    return {
      ok: false,
      message: typeof body.error === "string" ? body.error : "Couldn't serve that meme. Try again.",
    };
  }

  const data = read(body);
  if (!data) return { ok: false, message: "The kitchen sent something unexpected. Try again." };
  return { ok: true, data };
}

/** Transaksi dikirim sebagai base64 karena JSON tidak bisa memuat data mentah. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Ticker selalu huruf besar tanpa tanda $, sesuai yang diterima server. */
export function cleanTicker(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
