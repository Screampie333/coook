/**
 * Tipe bersama untuk semua cara membuat koin pump.fun.
 * Sekarang ada satu provider (PumpPortal). Nanti bisa ditambah SDK on-chain
 * tanpa mengubah kode fitur, persis seperti lapisan src/lib/ai.
 */

export type BuildCreateTransactionInput = {
  /** Alamat wallet pembuat koin (base58). Dia yang membayar biaya dan tanda tangan. */
  creator: string;
  /** Alamat mint koin baru (base58). Keypair-nya dibuat di server dan dipakai sekali. */
  mint: string;
  name: string;
  /** Ticker tanpa tanda $. */
  ticker: string;
  /** Alamat metadata JSON di IPFS. */
  metadataUri: string;
  /** Pembelian awal oleh pembuat, dalam SOL. 0 = tidak beli. */
  devBuySol: number;
  slippagePercent: number;
  priorityFeeSol: number;
};

export type BuildCreateTransactionResult = {
  /** Transaksi mentah (wire format) yang belum ditandatangani siapa pun. */
  transaction: Uint8Array;
  provider: string;
};

export interface LaunchProvider {
  name: string;
  buildCreateTransaction(input: BuildCreateTransactionInput): Promise<BuildCreateTransactionResult>;
}

export type LaunchErrorCode =
  /** Salah pengaturan di server: env kosong, provider tidak dikenal. */
  | "config"
  /** Provider menolak karena terlalu banyak request. */
  | "rate_limited"
  /** Provider tidak menjawab dalam batas waktu. */
  | "timeout"
  /** Provider atau RPC sedang tidak bisa dihubungi. */
  | "unavailable"
  /** Jawaban provider kosong atau bukan transaksi yang bisa dibaca. */
  | "bad_output"
  /**
   * Transaksi bisa dibaca, tapi isinya tidak sesuai harapan
   * (program asing, pembayar bukan user, biaya di luar batas).
   * Transaksi seperti ini TIDAK PERNAH dikirim ke wallet user.
   */
  | "unsafe_transaction"
  /** Transaksi ditolak jaringan Solana (misalnya blockhash sudah kedaluwarsa). */
  | "rejected"
  /** Error lain dari provider. */
  | "provider_error";

/** Satu jenis error untuk seluruh alur Serve, supaya kode fitur tidak perlu tahu format tiap provider. */
export class LaunchError extends Error {
  readonly code: LaunchErrorCode;
  /** Berapa detik harus menunggu sebelum mencoba lagi (hanya untuk rate_limited). */
  readonly retryAfterSeconds?: number;

  constructor(code: LaunchErrorCode, message: string, options: { retryAfterSeconds?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "LaunchError";
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
