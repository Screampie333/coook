/**
 * Aturan pembuatan koin pump.fun (tombol "Serve").
 * Ini satu-satunya tempat yang perlu diubah kalau angkanya mau diganti.
 */
export const LAUNCH = {
  /** Nama koin. 32 = batas keras metadata on-chain (Metaplex), tidak bisa dinaikkan. */
  nameMaxLength: 32,
  /** Ticker ditulis tanpa tanda $. 10 = batas keras on-chain. */
  tickerMinLength: 2,
  tickerMaxLength: 10,
  /** Deskripsi koin yang tampil di pump.fun. */
  descriptionMaxLength: 500,
  /** Alamat metadata di IPFS. 200 = batas keras on-chain. */
  metadataUriMaxLength: 200,

  /**
   * Pembelian awal oleh pembuat koin, dalam SOL.
   * 0 = tidak beli apa-apa, jadi tidak ada fee 0,5% PumpPortal maupun fee 0,95% pump.fun.
   * User bisa beli sendiri di pump.fun setelah koinnya jadi.
   */
  devBuySol: 0,
  /** Toleransi selisih harga untuk pembelian awal, dalam persen. Tidak terpakai kalau devBuySol = 0. */
  slippagePercent: 10,
  /** Priority fee supaya transaksi cepat masuk, dalam SOL. */
  priorityFeeSol: 0.0005,

  /**
   * Batas aman biaya sekali mint, dalam SOL.
   * Kalau hasil simulasi menunjukkan user harus membayar lebih dari ini, transaksi DITOLAK
   * dan tidak pernah sampai ke wallet user. Ini jaring pengaman kalau transaksi dari
   * pihak ketiga ternyata berisi sesuatu yang tidak kita harapkan.
   */
  maxCostSol: 0.1,

  /** Gateway untuk membuka file IPFS. */
  ipfsGateway: "https://ipfs.io/ipfs/",

  /** Website yang dicantumkan di metadata koin. */
  websiteUrl: "https://coook.ink",

  /** Halaman koin di pump.fun. */
  coinPageUrl: "https://pump.fun/coin/",
};

// Dicek saat server mulai, supaya salah ketik langsung ketahuan.
if (LAUNCH.tickerMinLength < 1 || LAUNCH.tickerMinLength > LAUNCH.tickerMaxLength) {
  throw new Error("src/config/launch.ts: tickerMinLength harus antara 1 dan tickerMaxLength.");
}
if (LAUNCH.nameMaxLength < 1 || LAUNCH.nameMaxLength > 32) {
  throw new Error("src/config/launch.ts: nameMaxLength maksimal 32 (batas on-chain).");
}
if (LAUNCH.tickerMaxLength > 10) {
  throw new Error("src/config/launch.ts: tickerMaxLength maksimal 10 (batas on-chain).");
}
if (LAUNCH.devBuySol < 0 || !Number.isFinite(LAUNCH.devBuySol)) {
  throw new Error("src/config/launch.ts: devBuySol tidak boleh negatif.");
}
if (LAUNCH.priorityFeeSol < 0 || LAUNCH.priorityFeeSol > 0.05) {
  throw new Error("src/config/launch.ts: priorityFeeSol harus antara 0 dan 0.05 SOL.");
}
if (LAUNCH.maxCostSol <= 0 || LAUNCH.maxCostSol > 1) {
  throw new Error("src/config/launch.ts: maxCostSol harus lebih dari 0 dan maksimal 1 SOL.");
}
