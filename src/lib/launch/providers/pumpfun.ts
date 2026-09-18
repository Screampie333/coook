import "server-only";

import { PROGRAMS } from "../programs";
import {
  LaunchError,
  type BuildCreateTransactionInput,
  type BuildCreateTransactionResult,
  type LaunchProvider,
} from "../types";

/**
 * Provider RESMI pump.fun.
 * Docs: https://github.com/pump-fun/pump-fun-skills (repo milik organisasi pump-fun sendiri)
 *
 * Kelebihan dibanding PumpPortal:
 * - Resmi dari pump.fun, bukan pihak ketiga.
 * - Mereka yang membuat DAN menandatangani kunci mint, jadi server kita tidak pernah
 *   memegang kunci itu sama sekali (satu risiko keamanan hilang).
 * - Tidak ada potongan 0,5%.
 *
 * Satu syaratnya: pembelian awal wajib lebih dari 0 (dicek langsung: kirim 0 dijawab
 * "solLamports must be > 0"), jadi LAUNCH.devBuySol tidak boleh nol untuk provider ini.
 */

const CREATE_URL = "https://fun-block.pump.fun/agents/create-coin";
const TIMEOUT_MS = 25_000;

const MAX_TRANSACTION_BYTES = 1232;
const MIN_TRANSACTION_BYTES = 64;
const LAMPORTS_PER_SOL = 1_000_000_000;

type CreateCoinResponse = {
  transaction?: unknown;
  mintPublicKey?: unknown;
};

async function buildCreateTransaction(input: BuildCreateTransactionInput): Promise<BuildCreateTransactionResult> {
  const lamports = Math.round(input.devBuySol * LAMPORTS_PER_SOL);
  if (lamports <= 0) {
    throw new LaunchError(
      "config",
      "The official pump.fun API needs an initial buy above 0. Set devBuySol in src/config/launch.ts.",
    );
  }

  let response: Response;
  try {
    response = await fetch(CREATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: input.creator,
        name: input.name,
        symbol: input.ticker,
        uri: input.metadataUri,
        solLamports: String(lamports),
        // Wajib ditulis. Bawaan API-nya base58, dan salah encoding membuat transaksi gagal.
        encoding: "base64",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw toNetworkError(error);
  }

  if (!response.ok) {
    throw await toHttpError(response);
  }

  let body: CreateCoinResponse;
  try {
    body = (await response.json()) as CreateCoinResponse;
  } catch (error) {
    if (isTimeout(error)) throw toNetworkError(error);
    throw new LaunchError("bad_output", "pump.fun returned a response that is not JSON.", { cause: error });
  }

  const encoded = body.transaction;
  const mintAddress = body.mintPublicKey;
  if (typeof encoded !== "string" || !encoded) {
    throw new LaunchError("bad_output", "pump.fun did not return a transaction.");
  }
  if (typeof mintAddress !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mintAddress)) {
    throw new LaunchError("bad_output", "pump.fun did not return a usable coin address.");
  }

  const transaction = new Uint8Array(Buffer.from(encoded, "base64"));
  if (transaction.length < MIN_TRANSACTION_BYTES || transaction.length > MAX_TRANSACTION_BYTES) {
    throw new LaunchError("bad_output", `pump.fun returned ${transaction.length} bytes instead of a transaction.`);
  }

  return { transaction, mintAddress, provider: "pumpfun" };
}

function isTimeout(error: unknown) {
  return (error as { name?: unknown } | null)?.name === "TimeoutError";
}

function toNetworkError(error: unknown) {
  if (isTimeout(error)) {
    return new LaunchError("timeout", `pump.fun did not answer within ${TIMEOUT_MS / 1000}s.`, { cause: error });
  }
  return new LaunchError("unavailable", "Could not reach pump.fun.", { cause: error });
}

async function toHttpError(response: Response) {
  const status = response.status;
  const detail = await readErrorMessage(response);

  if (status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    return new LaunchError("rate_limited", `pump.fun rate limit reached: ${detail}`, {
      retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : undefined,
    });
  }
  if (status >= 500) {
    return new LaunchError("unavailable", `pump.fun is unavailable (${status}): ${detail}`);
  }
  // 400 biasanya berarti nama/ticker/uri tidak diterima.
  return new LaunchError("provider_error", `pump.fun rejected the request (${status}): ${detail}`);
}

/** Format error: { "message": "...", "error": "Bad Request", "statusCode": 400 } */
async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string") return body.message.slice(0, 300);
    if (Array.isArray(body.message)) return body.message.join("; ").slice(0, 300);
  } catch {
    // Body bukan JSON. Pakai status text saja.
  }
  return response.statusText || "no details";
}

export const pumpFunProvider: LaunchProvider = {
  name: "pumpfun",
  cluster: "mainnet",
  isReal: true,
  // pump.fun sendiri yang memegang kunci mint dan menandatanganinya.
  ownsMintKey: true,
  // Dicek langsung dari transaksi yang mereka kirim: Compute Budget, pump.fun, dan ATA.
  // Sisanya ikut didaftarkan karena wajar muncul di alur pembuatan koin.
  allowedPrograms: [
    PROGRAMS.pumpFun,
    PROGRAMS.system,
    PROGRAMS.token,
    PROGRAMS.associatedToken,
    PROGRAMS.metaplexMetadata,
    PROGRAMS.computeBudget,
  ],
  requiredProgram: PROGRAMS.pumpFun,
  buildCreateTransaction,
};
