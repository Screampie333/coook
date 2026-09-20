import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  MEMO_PROGRAM_ADDRESS,
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
} from "./program-imports";

/**
 * Alamat program Solana yang dipakai fitur Serve.
 *
 * Alamat yang sudah disediakan paket resmi (@solana-program/*) diambil dari sana,
 * bukan diketik ulang, supaya tidak ada salah ketik.
 * Sisanya sudah saya cek langsung ke jaringan Solana.
 */
export const PROGRAMS = {
  /** Program pump.fun. Dicek ada dan executable di mainnet maupun devnet. */
  pumpFun: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  /** Dipanggil pump.fun untuk membuat metadata koin. */
  metaplexMetadata: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
  /** Mengatur biaya prioritas transaksi. */
  computeBudget: "ComputeBudget111111111111111111111111111111",
  /**
   * Pemungut fee PumpPortal (0,5% dari pembelian awal).
   * Hanya muncul di transaksi PumpPortal yang pembelian awalnya lebih dari 0 —
   * sudah saya buktikan dengan membandingkan transaksi dev buy 0 dan 0,1 SOL.
   * Alamatnya dicek ke mainnet: ada dan executable.
   */
  pumpPortalFee: "FAdo9NCw1ssek6Z6yeWzWjhLVsr8uiCwcWNUnKgzTnHe",
  system: SYSTEM_PROGRAM_ADDRESS as string,
  token: TOKEN_PROGRAM_ADDRESS as string,
  associatedToken: ASSOCIATED_TOKEN_PROGRAM_ADDRESS as string,
  memo: MEMO_PROGRAM_ADDRESS as string,
} as const;

/** Nama yang bisa dibaca manusia, dipakai di pesan error dan log. */
export const PROGRAM_NAMES: Readonly<Record<string, string>> = {
  [PROGRAMS.pumpFun]: "pump.fun",
  [PROGRAMS.metaplexMetadata]: "Metaplex Token Metadata",
  [PROGRAMS.computeBudget]: "Compute Budget",
  [PROGRAMS.pumpPortalFee]: "PumpPortal fee",
  [PROGRAMS.system]: "System",
  [PROGRAMS.token]: "SPL Token",
  [PROGRAMS.associatedToken]: "Associated Token Account",
  [PROGRAMS.memo]: "Memo",
};

export function programName(address: string) {
  return PROGRAM_NAMES[address] ?? address;
}
