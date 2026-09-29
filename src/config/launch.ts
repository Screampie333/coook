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
   * Pembelian awal oleh pembuat koin, dalam SOL. Dia langsung memegang koinnya sendiri.
   * User yang menentukan jumlahnya di layar Serve.
   *
   * Bawaannya 0 = tidak membeli apa-apa. Dengan PumpPortal, 0 berarti tidak ada
   * instruksi fee sama sekali di transaksinya (sudah dibuktikan dengan membandingkan
   * transaksi dev buy 0 dan 0,1 SOL), jadi potongan 0,5% mereka juga nol.
   *
   * Catatan: provider "pumpfun" (API resmi) menolak 0 dan akan memberi pesan error
   * yang jelas. Angka ini hanya cocok untuk provider yang menerima 0.
   */
  defaultDevBuySol: 0,
  minDevBuySol: 0,
  /** Batas atas, penjaga supaya salah ketik tidak berakibat fatal. */
  maxDevBuySol: 10,
  /** Toleransi selisih harga untuk pembelian awal, dalam persen. Tidak terpakai kalau devBuySol = 0. */
  slippagePercent: 10,
  /** Priority fee supaya transaksi cepat masuk, dalam SOL. */
  priorityFeeSol: 0.0005,

  /**
   * Batas aman biaya DI LUAR pembelian awal, dalam SOL (sewa akun + fee jaringan).
   *
   * Kalau simulasi menunjukkan transaksi mengambil lebih dari (pembelian awal + angka ini),
   * transaksi DITOLAK dan tidak pernah sampai ke wallet user. Ini jaring pengaman kalau
   * transaksi dari pihak ketiga ternyata berisi sesuatu yang tidak kita harapkan.
   *
   * Yang dibatasi hanya kelebihannya, bukan totalnya, karena pembelian awal itu
   * memang jumlah yang user pilih sendiri.
   *
   * Acuannya diukur dari transaksi sungguhan di mainnet: 0,0102 SOL.
   * Batas 0,05 memberi kelonggaran kalau biaya on-chain naik.
   */
  maxOverheadSol: 0.05,

  /** Gateway untuk membuka file IPFS. */
  ipfsGateway: "https://ipfs.io/ipfs/",

  /** Website yang dicantumkan di metadata koin. */
  websiteUrl: "https://kuk.ink",

  /**
   * Batas percobaan membuat koin per wallet per hari (reset 00:00 WIB, sama dengan Cook).
   *
   * Yang dibatasi adalah PERCOBAAN, bukan koin yang jadi. Setiap percobaan menyuruh
   * server kita menggambar ulang gambar, menerbitkannya ke IPFS (permanen dan tidak
   * bisa dihapus), memanggil filter isi, PumpPortal, dan RPC — semuanya biaya kita,
   * sementara user tidak membayar apa pun sampai dia benar-benar tanda tangan.
   *
   * Tanpa batas ini, satu wallet bisa memanggilnya tanpa henti sambil mengganti
   * caption tiap kali, dan setiap kali menambah file baru ke akun Pinata kita.
   *
   * Angkanya sengaja longgar: user hanya bisa membuat 3 meme per hari, jadi 20
   * percobaan berarti masih ada banyak ruang untuk mengulang kalau ada yang gagal.
   */
  dailyAttempts: 20,

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
if (!Number.isFinite(LAUNCH.minDevBuySol) || LAUNCH.minDevBuySol < 0) {
  throw new Error("src/config/launch.ts: minDevBuySol tidak boleh negatif.");
}
if (LAUNCH.defaultDevBuySol < LAUNCH.minDevBuySol || LAUNCH.defaultDevBuySol > LAUNCH.maxDevBuySol) {
  throw new Error("src/config/launch.ts: defaultDevBuySol harus antara minDevBuySol dan maxDevBuySol.");
}
if (LAUNCH.priorityFeeSol < 0 || LAUNCH.priorityFeeSol > 0.05) {
  throw new Error("src/config/launch.ts: priorityFeeSol harus antara 0 dan 0.05 SOL.");
}
if (LAUNCH.maxOverheadSol <= 0 || LAUNCH.maxOverheadSol > 1) {
  throw new Error("src/config/launch.ts: maxOverheadSol harus lebih dari 0 dan maksimal 1 SOL.");
}
if (!Number.isInteger(LAUNCH.dailyAttempts) || LAUNCH.dailyAttempts < 1) {
  throw new Error("src/config/launch.ts: dailyAttempts harus bilangan bulat minimal 1.");
}
