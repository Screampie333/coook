import "server-only";

import { getAddMemoInstruction } from "@solana-program/memo";
import { getCreateAccountInstruction } from "@solana-program/system";
import { getInitializeMint2Instruction, getMintSize, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
} from "@solana/kit";
import { PROGRAMS } from "../programs";
import { getRpc } from "../rpc";
import {
  LaunchError,
  type BuildCreateTransactionInput,
  type BuildCreateTransactionResult,
  type LaunchProvider,
} from "../types";

/**
 * Provider LATIHAN di devnet. Dipakai untuk mengetes alur Serve tanpa mengeluarkan uang sungguhan.
 *
 * Yang dibuat di sini BUKAN koin pump.fun, melainkan token SPL biasa di devnet.
 * Tujuannya cuma satu: menguji bagian yang paling belum terbukti, yaitu
 * "server tanda tangan duluan dengan keypair mint, lalu user tanda tangan di Phantom".
 * Struktur transaksinya sengaja dibuat sama dengan versi aslinya:
 *   - pembayar biaya = wallet user
 *   - dua penanda tangan wajib = wallet user + mint baru
 *   - akun mint dibuat dan diinisialisasi dalam satu transaksi
 *
 * pump.fun tidak punya devnet (dinyatakan di FAQ PumpPortal), jadi instruksi
 * create milik pump.fun memang hanya bisa dibuktikan sekali di mainnet.
 *
 * Aktifkan dengan LAUNCH_PROVIDER=devnet di .env.local.
 */

/** Sama dengan pump.fun, supaya angka di UI terasa mirip saat latihan. */
const DECIMALS = 6;

async function buildCreateTransaction(input: BuildCreateTransactionInput): Promise<BuildCreateTransactionResult> {
  const rpc = getRpc("devnet");

  // Akun mint harus dibayar sewanya di muka, sesuai ukurannya.
  const space = BigInt(getMintSize());
  let lamports: bigint;
  let blockhash: Awaited<ReturnType<ReturnType<typeof rpc.getLatestBlockhash>["send"]>>["value"];
  try {
    const [rent, latest] = await Promise.all([
      rpc.getMinimumBalanceForRentExemption(space).send(),
      rpc.getLatestBlockhash({ commitment: "confirmed" }).send(),
    ]);
    lamports = rent;
    blockhash = latest.value;
  } catch (error) {
    throw new LaunchError("unavailable", "Could not reach the Solana devnet RPC.", { cause: error });
  }

  // createNoopSigner = "akun ini WAJIB tanda tangan", tapi tanda tangannya menyusul:
  // mint ditandatangani server (lihat index.ts), creator ditandatangani user di wallet-nya.
  const creator = createNoopSigner(input.creator as Address);
  const mint = createNoopSigner(input.mint as Address);

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(creator, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) =>
      appendTransactionMessageInstructions(
        [
          getCreateAccountInstruction({
            payer: creator,
            newAccount: mint,
            lamports,
            space,
            programAddress: TOKEN_PROGRAM_ADDRESS,
          }),
          getInitializeMint2Instruction({
            mint: mint.address,
            decimals: DECIMALS,
            mintAuthority: creator.address,
            freezeAuthority: null,
          }),
          // Supaya di explorer kelihatan ini token latihan, bukan koin sungguhan.
          getAddMemoInstruction({
            memo: `Coook devnet practice: ${input.name} (${input.ticker})`,
          }),
        ],
        m,
      ),
  );

  const transaction = compileTransaction(message);
  return {
    transaction: new Uint8Array(getTransactionEncoder().encode(transaction)),
    provider: "devnet",
  };
}

export const devnetProvider: LaunchProvider = {
  name: "devnet",
  cluster: "devnet",
  // Koin ini tidak bernilai dan tidak ada di pump.fun. UI harus mengatakannya dengan jelas.
  isReal: false,
  allowedPrograms: [PROGRAMS.system, PROGRAMS.token, PROGRAMS.memo, PROGRAMS.computeBudget],
  requiredProgram: PROGRAMS.token,
  buildCreateTransaction,
};
