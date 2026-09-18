import "server-only";

import {
  createSolanaRpc,
  type Address,
  type Base64EncodedWireTransaction,
  type Signature,
} from "@solana/kit";
import { LAUNCH } from "@/config/launch";
import { LaunchError } from "./types";

/**
 * Sambungan ke jaringan Solana. Hanya dipakai di server (alamat RPC bisa berisi API key).
 *
 * Dipakai untuk tiga hal:
 * 1. Simulasi transaksi sebelum user tanda tangan (biar error ketahuan lebih dulu dan
 *    biayanya bisa ditunjukkan ke user).
 * 2. Mengirim transaksi yang sudah ditandatangani user.
 * 3. Menunggu transaksi benar-benar masuk ke blockchain.
 */

const LAMPORTS_PER_SOL = 1_000_000_000;
const CONFIRM_TIMEOUT_MS = 60_000;
const CONFIRM_POLL_MS = 1_500;

/** Dipakai juga oleh verify.ts untuk membaca address lookup table. */
export function getRpc() {
  const url = process.env.SOLANA_RPC_URL?.trim();
  if (!url) {
    throw new LaunchError("config", "SOLANA_RPC_URL is missing.");
  }
  if (!url.startsWith("https://")) {
    throw new LaunchError("config", "SOLANA_RPC_URL must start with https://");
  }
  return createSolanaRpc(url);
}

/** true kalau alamat RPC sudah diisi. Dipakai untuk memberi pesan yang jelas lebih awal. */
export function isRpcConfigured() {
  return Boolean(process.env.SOLANA_RPC_URL?.trim());
}

function toBase64(wireTransaction: Uint8Array) {
  return Buffer.from(wireTransaction).toString("base64") as Base64EncodedWireTransaction;
}

export type SimulationResult = {
  /** true kalau transaksi berjalan mulus di simulasi. */
  ok: boolean;
  /** Pesan error dari jaringan kalau gagal. */
  error: string | null;
  /** Perkiraan SOL yang keluar dari wallet user. */
  costSol: number;
  logs: string[];
};

/**
 * Menjalankan transaksi "seolah-olah" di node RPC tanpa mengirimnya ke jaringan.
 * Tanda tangan tidak diperiksa (sigVerify: false), jadi ini bisa dipakai sebelum user tanda tangan.
 */
export async function simulateTransaction(wireTransaction: Uint8Array, payer: string): Promise<SimulationResult> {
  const rpc = getRpc();
  const address = payer as Address;

  let before: bigint;
  let value: Awaited<ReturnType<typeof runSimulation>>;
  try {
    // Saldo sebelum dan hasil simulasi diambil bersamaan supaya cepat.
    const [balance, simulation] = await Promise.all([
      rpc.getBalance(address).send(),
      runSimulation(rpc, wireTransaction, address),
    ]);
    before = balance.value;
    value = simulation;
  } catch (error) {
    throw toRpcError(error, "simulate the transaction");
  }

  // Saldo sesudah transaksi dijalankan; selisihnya = yang dibayar user.
  const after = value.accounts?.[0]?.lamports ?? before;
  const costLamports = Number(before - after);

  return {
    ok: value.err === null,
    error: value.err === null ? null : describeError(value.err),
    costSol: costLamports > 0 ? costLamports / LAMPORTS_PER_SOL : 0,
    logs: value.logs ?? [],
  };
}

async function runSimulation(rpc: ReturnType<typeof getRpc>, wireTransaction: Uint8Array, payer: Address) {
  const response = await rpc
    .simulateTransaction(toBase64(wireTransaction), {
      encoding: "base64",
      // Tanda tangan tidak diperiksa supaya bisa disimulasikan sebelum user tanda tangan.
      sigVerify: false,
      replaceRecentBlockhash: true,
      accounts: { addresses: [payer], encoding: "base64" },
    })
    .send();
  return response.value;
}

/**
 * Pemeriksaan terakhir sebelum transaksi dikirim ke wallet user.
 * Menolak kalau transaksinya gagal di simulasi atau biayanya di luar batas wajar.
 */
export async function assertSafeToSign(wireTransaction: Uint8Array, payer: string): Promise<SimulationResult> {
  const result = await simulateTransaction(wireTransaction, payer);

  if (!result.ok) {
    // Baris log terakhir biasanya menjelaskan penyebabnya.
    const lastLog = result.logs.at(-1);
    throw new LaunchError(
      "rejected",
      `Solana rejected the transaction in a test run: ${result.error}${lastLog ? ` (${lastLog})` : ""}`,
    );
  }
  if (result.costSol > LAUNCH.maxCostSol) {
    throw new LaunchError(
      "unsafe_transaction",
      `Coook refused the transaction because it would take ${result.costSol.toFixed(4)} SOL from your wallet, ` +
        `more than the ${LAUNCH.maxCostSol} SOL limit.`,
    );
  }
  return result;
}

/** Mengirim transaksi yang sudah ditandatangani user. Mengembalikan tanda tangan transaksi. */
export async function sendSignedTransaction(wireTransaction: Uint8Array): Promise<string> {
  const rpc = getRpc();
  try {
    return await rpc
      .sendTransaction(toBase64(wireTransaction), {
        encoding: "base64",
        // Sudah disimulasikan sebelum ditandatangani, jadi preflight cukup sekali di sini.
        preflightCommitment: "confirmed",
        maxRetries: BigInt(3),
      })
      .send();
  } catch (error) {
    throw toRpcError(error, "send the transaction");
  }
}

/**
 * Menunggu sampai transaksi benar-benar masuk blockchain.
 * Mengembalikan true kalau berhasil; melempar error kalau transaksinya gagal atau kelamaan.
 */
export async function waitForTransaction(signature: string): Promise<void> {
  const rpc = getRpc();
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;

  while (Date.now() < deadline) {
    let status;
    try {
      const response = await rpc.getSignatureStatuses([signature as Signature]).send();
      status = response.value[0];
    } catch (error) {
      throw toRpcError(error, "check the transaction");
    }

    if (status) {
      if (status.err) {
        throw new LaunchError("rejected", `The transaction failed on Solana: ${describeError(status.err)}`);
      }
      if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
        return;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, CONFIRM_POLL_MS));
  }

  throw new LaunchError(
    "timeout",
    "The transaction was sent but Solana did not confirm it in time. Check your wallet before trying again.",
  );
}

/** true kalau alamat ini sudah ada di blockchain. Dipakai untuk memastikan koinnya benar-benar jadi. */
export async function accountExists(address: string): Promise<boolean> {
  const rpc = getRpc();
  try {
    const response = await rpc.getAccountInfo(address as Address, { encoding: "base64" }).send();
    return response.value !== null;
  } catch (error) {
    throw toRpcError(error, "look up the coin");
  }
}

function describeError(error: unknown) {
  if (typeof error === "string") return error;
  try {
    // Jawaban RPC bisa memuat BigInt, yang membuat JSON.stringify biasa gagal.
    return JSON.stringify(error, (_key, value) => (typeof value === "bigint" ? value.toString() : value)).slice(0, 300);
  } catch {
    return String(error).slice(0, 300);
  }
}

function toRpcError(error: unknown, action: string) {
  if (error instanceof LaunchError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new LaunchError("unavailable", `Could not ${action} (Solana RPC): ${message.slice(0, 300)}`, {
    cause: error,
  });
}
