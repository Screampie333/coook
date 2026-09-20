import "server-only";

import { PROGRAMS } from "../programs";
import {
  LaunchError,
  type BuildCreateTransactionInput,
  type BuildCreateTransactionResult,
  type LaunchProvider,
} from "../types";

/**
 * Provider PumpPortal, mode "Local Transaction".
 * Docs: https://pumpportal.fun/creation/ dan https://pumpportal.fun/local-trading-api/trading-api/
 *
 * Server hanya MEMINTA transaksi ke PumpPortal; yang menandatangani tetap wallet user.
 * Tidak butuh API key (API key hanya untuk mode Lightning, yang menitipkan private key
 * ke pihak lain — itu melanggar aturan project ini).
 *
 * Biaya PumpPortal: 0,5% per trade. Pembuatan koin sendiri tidak kena fee, jadi
 * kalau devBuySol = 0 maka fee PumpPortal juga 0.
 */

const TRADE_LOCAL_URL = "https://pumpportal.fun/api/trade-local";
const TIMEOUT_MS = 20_000;

/** Transaksi Solana tidak mungkin lebih besar dari ini. Dipakai untuk menolak jawaban aneh. */
const MAX_TRANSACTION_BYTES = 1232;
const MIN_TRANSACTION_BYTES = 64;

async function buildCreateTransaction(input: BuildCreateTransactionInput): Promise<BuildCreateTransactionResult> {
  // Provider ini tidak membuat kunci mint sendiri, jadi alamatnya harus kita siapkan.
  const mintAddress = input.mint;
  if (!mintAddress) {
    throw new LaunchError("config", "PumpPortal needs a mint address prepared by the server.");
  }

  const body = {
    publicKey: input.creator,
    action: "create" as const,
    tokenMetadata: {
      name: input.name,
      symbol: input.ticker,
      uri: input.metadataUri,
    },
    mint: mintAddress,
    // Angka pembelian awal dihitung dalam SOL, bukan dalam jumlah token.
    denominatedInSol: "true",
    amount: input.devBuySol,
    slippage: input.slippagePercent,
    priorityFee: input.priorityFeeSol,
    pool: "pump" as const,
  };

  let response: Response;
  try {
    response = await fetch(TRADE_LOCAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw toNetworkError(error);
  }

  if (!response.ok) {
    throw await toHttpError(response);
  }

  // Jawaban sukses berupa transaksi mentah (binary), bukan JSON.
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (isTimeout(error)) throw toNetworkError(error);
    throw new LaunchError("bad_output", "PumpPortal did not return a readable transaction.", { cause: error });
  }

  if (bytes.length < MIN_TRANSACTION_BYTES || bytes.length > MAX_TRANSACTION_BYTES) {
    // Kadang error dikirim sebagai teks dengan status 200.
    const text = new TextDecoder().decode(bytes.subarray(0, 300)).trim();
    throw new LaunchError(
      "bad_output",
      `PumpPortal returned ${bytes.length} bytes instead of a transaction${text ? `: ${text}` : "."}`,
    );
  }

  return { transaction: bytes, mintAddress, provider: "pumpportal" };
}

function isTimeout(error: unknown) {
  return (error as { name?: unknown } | null)?.name === "TimeoutError";
}

function toNetworkError(error: unknown) {
  if (isTimeout(error)) {
    return new LaunchError("timeout", `PumpPortal did not answer within ${TIMEOUT_MS / 1000}s.`, { cause: error });
  }
  return new LaunchError("unavailable", "Could not reach PumpPortal.", { cause: error });
}

async function toHttpError(response: Response) {
  const status = response.status;
  const detail = await readErrorMessage(response);

  if (status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    return new LaunchError("rate_limited", `PumpPortal rate limit reached: ${detail}`, {
      retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : undefined,
    });
  }
  if (status >= 500) {
    return new LaunchError("unavailable", `PumpPortal is unavailable (${status}): ${detail}`);
  }
  // 400 biasanya berarti isi permintaan salah (nama/ticker/uri tidak diterima).
  return new LaunchError("provider_error", `PumpPortal rejected the request (${status}): ${detail}`);
}

async function readErrorMessage(response: Response) {
  try {
    const text = (await response.text()).trim();
    if (text) return text.slice(0, 300);
  } catch {
    // Body tidak bisa dibaca. Pakai status text saja.
  }
  return response.statusText || "no details";
}

export const pumpPortalProvider: LaunchProvider = {
  name: "pumpportal",
  // PumpPortal tidak menyediakan devnet sama sekali (dinyatakan di FAQ resmi mereka).
  cluster: "mainnet",
  isReal: true,
  // Server kita yang menyiapkan kunci mint, memakainya sekali, lalu membuangnya.
  ownsMintKey: false,
  allowedPrograms: [
    PROGRAMS.pumpFun,
    PROGRAMS.system,
    PROGRAMS.token,
    PROGRAMS.associatedToken,
    PROGRAMS.metaplexMetadata,
    PROGRAMS.computeBudget,
    // Muncul hanya kalau pembelian awal lebih dari 0. Diizinkan supaya user tetap
    // bisa dev buy; yang benar-benar menjaga jumlah SOL keluar adalah batas biaya
    // dari simulasi (maxOverheadSol), bukan daftar ini.
    PROGRAMS.pumpPortalFee,
  ],
  requiredProgram: PROGRAMS.pumpFun,
  buildCreateTransaction,
};
