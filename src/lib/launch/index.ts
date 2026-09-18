import "server-only";

import { getTransactionEncoder, partiallySignTransaction } from "@solana/kit";
import { LAUNCH } from "@/config/launch";
import { createMintKeyPair } from "./mint-key";
import { devnetProvider } from "./providers/devnet";
import { pumpPortalProvider } from "./providers/pumpportal";
import { assertSafeToSign, type SimulationResult } from "./rpc";
import { LaunchError, type Cluster, type LaunchProvider } from "./types";
import { inspectCreateTransaction, type CreateTransactionReport } from "./verify";

/**
 * Pintu masuk fitur "Serve" untuk seluruh aplikasi.
 *
 * Kode fitur cukup memanggil prepareCreateTransaction(). Provider dipilih lewat env:
 *   LAUNCH_PROVIDER=pumpportal  (default) — koin sungguhan di pump.fun, mainnet, bayar SOL asli
 *   LAUNCH_PROVIDER=devnet                — token latihan di devnet, gratis, untuk testing
 *
 * Menambah cara lain (misalnya SDK on-chain pump.fun):
 *   1. Buat src/lib/launch/providers/pumpsdk.ts yang mengekspor LaunchProvider.
 *   2. Daftarkan di PROVIDERS di bawah.
 * Kode fitur tidak perlu diubah.
 */

const DEFAULT_PROVIDER = "pumpportal";

const PROVIDERS = new Map<string, LaunchProvider>([
  [pumpPortalProvider.name, pumpPortalProvider],
  [devnetProvider.name, devnetProvider],
]);

export function getLaunchProvider(): LaunchProvider {
  const name = process.env.LAUNCH_PROVIDER?.trim().toLowerCase() || DEFAULT_PROVIDER;
  const provider = PROVIDERS.get(name);
  if (!provider) {
    const available = [...PROVIDERS.keys()].join(", ");
    throw new LaunchError("config", `LAUNCH_PROVIDER "${name}" is not available yet. Available: ${available}.`);
  }
  return provider;
}

export type PrepareCreateInput = {
  /** Wallet user, diambil dari data Privy yang sudah diverifikasi server. */
  creator: string;
  name: string;
  /** Ticker tanpa tanda $. */
  ticker: string;
  /** Alamat metadata JSON di IPFS. */
  metadataUri: string;
};

export type PreparedCreateTransaction = {
  /** Alamat koin baru (contract address di pump.fun). */
  mintAddress: string;
  /** Transaksi yang sudah ditandatangani mint, tinggal ditandatangani user. */
  transaction: Uint8Array;
  /** Isi transaksi setelah diperiksa. Dipakai untuk ditampilkan dan dicatat di log. */
  report: CreateTransactionReport;
  /** Hasil simulasi: perkiraan biaya yang dibayar user. */
  simulation: SimulationResult;
  provider: string;
  cluster: Cluster;
  /** false = token latihan di devnet, bukan koin pump.fun sungguhan. */
  isReal: boolean;
};

/**
 * Menyiapkan transaksi pembuatan koin yang siap ditandatangani user.
 *
 * Urutannya penting:
 * 1. Buat keypair mint baru (dibuang setelah dipakai).
 * 2. Minta transaksi ke provider.
 * 3. PERIKSA isi transaksinya. Kalau aneh, berhenti di sini.
 * 4. Tanda tangani dengan keypair mint.
 * 5. Simulasikan ke jaringan: kalau gagal atau biayanya di luar batas, berhenti juga.
 *
 * Transaksi baru dikirim ke browser kalau semua langkah di atas lolos.
 */
export async function prepareCreateTransaction(input: PrepareCreateInput): Promise<PreparedCreateTransaction> {
  const provider = getLaunchProvider();
  const mint = await createMintKeyPair();

  const built = await provider.buildCreateTransaction({
    creator: input.creator,
    mint: mint.address,
    name: input.name,
    ticker: input.ticker,
    metadataUri: input.metadataUri,
    devBuySol: LAUNCH.devBuySol,
    slippagePercent: LAUNCH.slippagePercent,
    priorityFeeSol: LAUNCH.priorityFeeSol,
  });

  const { transaction, report } = await inspectCreateTransaction(
    built.transaction,
    { creator: input.creator, mint: mint.address },
    provider,
  );

  const signed = await partiallySignTransaction([mint.keyPair], transaction);
  const bytes = new Uint8Array(getTransactionEncoder().encode(signed));

  const simulation = await assertSafeToSign(bytes, input.creator, provider.cluster);

  return {
    mintAddress: mint.address,
    transaction: bytes,
    report,
    simulation,
    provider: built.provider,
    cluster: provider.cluster,
    isReal: provider.isReal,
  };
}

export { LaunchError } from "./types";
export type { Cluster, LaunchErrorCode } from "./types";
export { sendSignedTransaction, waitForTransaction, accountExists, isRpcConfigured } from "./rpc";
export type { SimulationResult } from "./rpc";
export type { CreateTransactionReport } from "./verify";
