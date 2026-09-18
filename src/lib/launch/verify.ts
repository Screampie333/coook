import "server-only";

import {
  decompileTransactionMessageFetchingLookupTables,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  isFullySignedTransaction,
  type CompiledTransactionMessage,
  type CompiledTransactionMessageWithLifetime,
  type Transaction,
} from "@solana/kit";
import { programName } from "./programs";
import { getRpc } from "./rpc";
import { LaunchError, type LaunchProvider } from "./types";

/**
 * Memeriksa isi transaksi yang dibuat pihak ketiga SEBELUM dikirim ke wallet user.
 *
 * Kenapa perlu: transaksi pembuatan koin dibuat oleh PumpPortal, bukan oleh kita.
 * Kalau server mereka bermasalah atau dibajak, user bisa saja diminta menandatangani
 * transaksi yang menguras wallet-nya. Karena itu server membongkar transaksinya dulu
 * dan menolak apa pun yang tidak sesuai harapan.
 *
 * Yang diperiksa:
 * 1. Bisa dibaca sebagai transaksi Solana.
 * 2. Pembayar biaya = wallet user, bukan orang lain.
 * 3. Yang wajib tanda tangan hanya dua: wallet user dan mint koin baru.
 * 4. Punya blockhash, jadi ada masa berlakunya.
 * 5. Semua program yang dipanggil ada di daftar yang kita izinkan.
 *
 * Catatan: transaksi pump.fun memakai address lookup table (daftar alamat yang
 * disimpan on-chain supaya transaksi lebih ringkas), jadi sebagian alamat harus
 * diambil dulu dari jaringan sebelum bisa diperiksa.
 *
 * Pengaman terakhir bukan di file ini: berapa pun isinya, jumlah SOL yang benar-benar
 * keluar dari wallet user dibatasi lewat simulasi (lihat assertSafeToSign di rpc.ts).
 */

export type CreateTransactionReport = {
  /** Wallet yang membayar semua biaya. Harus wallet user. */
  feePayer: string;
  /** Alamat yang wajib menandatangani transaksi ini. */
  signers: string[];
  /** Program yang dipanggil, sudah diterjemahkan jadi nama yang bisa dibaca. */
  programs: string[];
  instructionCount: number;
  /** Berapa address lookup table yang dipakai transaksi ini. */
  lookupTables: number;
  version: "legacy" | 0;
};

export type InspectedTransaction = {
  /** Transaksi yang sudah dibaca, siap ditandatangani keypair mint. */
  transaction: Transaction;
  report: CreateTransactionReport;
};

/** Bagian provider yang dibutuhkan pemeriksa: jaringan dan daftar program yang diizinkan. */
export type VerifyRules = Pick<LaunchProvider, "cluster" | "allowedPrograms" | "requiredProgram">;

/** Membaca transaksi mentah dan menolaknya kalau isinya tidak sesuai harapan. */
export async function inspectCreateTransaction(
  wireTransaction: Uint8Array,
  expected: { creator: string; mint: string },
  rules: VerifyRules,
): Promise<InspectedTransaction> {
  let transaction: Transaction;
  try {
    transaction = getTransactionDecoder().decode(wireTransaction);
  } catch (error) {
    throw new LaunchError("bad_output", "The transaction could not be read.", { cause: error });
  }

  let message: CompiledTransactionMessage;
  try {
    message = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
  } catch (error) {
    throw new LaunchError("bad_output", "The transaction contents could not be read.", { cause: error });
  }

  const accounts = message.staticAccounts as readonly string[];

  // 2. Pembayar biaya selalu akun pertama, dan selalu ada di daftar utama
  //    (alamat dari lookup table tidak boleh jadi penanda tangan).
  const feePayer = accounts[0];
  if (!feePayer) throw unsafe("it has no fee payer");
  if (feePayer !== expected.creator) {
    throw unsafe(`the fee payer is ${feePayer} instead of your wallet`);
  }

  // 3. Hanya wallet user dan mint baru yang boleh wajib tanda tangan.
  const signers = accounts.slice(0, message.header.numSignerAccounts);
  const wanted = new Set([expected.creator, expected.mint]);
  if (signers.length !== wanted.size || signers.some((address) => !wanted.has(address))) {
    throw unsafe(`it asks ${signers.length} signature(s) from ${signers.join(", ") || "nobody"}`);
  }

  // Tempat tanda tangan yang disediakan harus sama dengan daftar penanda tangan.
  const slots = Object.keys(transaction.signatures);
  if (slots.length !== signers.length || slots.some((address) => !wanted.has(address))) {
    throw unsafe("the signature slots do not match the required signers");
  }

  // 4. Tanpa blockhash, transaksi tidak punya masa berlaku.
  if (!hasLifetime(message)) {
    throw unsafe("it has no blockhash, so it would never expire");
  }
  if (message.instructions.length === 0) {
    throw unsafe("it does nothing");
  }

  // 5. Terjemahkan dulu alamat yang tersimpan di lookup table, lalu periksa programnya.
  let decompiled;
  try {
    decompiled = await decompileTransactionMessageFetchingLookupTables(message, getRpc(rules.cluster));
  } catch (error) {
    if (error instanceof LaunchError) throw error;
    throw new LaunchError("unavailable", "Could not read the accounts used by the transaction.", { cause: error });
  }

  const programs: string[] = [];
  let hasRequired = false;
  for (const instruction of decompiled.instructions) {
    const address = instruction.programAddress as string;
    if (!rules.allowedPrograms.includes(address)) {
      throw unsafe(`it calls an unexpected program: ${address}`);
    }
    if (address === rules.requiredProgram) hasRequired = true;
    const name = programName(address);
    if (!programs.includes(name)) programs.push(name);
  }
  if (!hasRequired) {
    throw unsafe(`it never calls the ${programName(rules.requiredProgram)} program`);
  }

  return {
    transaction,
    report: {
      feePayer,
      signers: [...signers],
      programs,
      instructionCount: decompiled.instructions.length,
      lookupTables: message.version === "legacy" ? 0 : (message.addressTableLookups?.length ?? 0),
      version: message.version,
    },
  };
}

/**
 * Memeriksa transaksi yang DIKEMBALIKAN browser setelah user tanda tangan.
 *
 * Browser bisa saja mengirim transaksi lain untuk kita siarkan, jadi isinya diperiksa
 * dengan aturan yang sama seperti saat dibuat, ditambah: tanda tangannya harus lengkap.
 */
export async function inspectSignedTransaction(
  wireTransaction: Uint8Array,
  expected: { creator: string; mint: string },
  rules: VerifyRules,
): Promise<InspectedTransaction> {
  const inspected = await inspectCreateTransaction(wireTransaction, expected, rules);

  if (!isFullySignedTransaction(inspected.transaction)) {
    throw new LaunchError("bad_output", "The transaction is missing a signature. Try signing it again.");
  }
  return inspected;
}

function hasLifetime(
  message: CompiledTransactionMessage,
): message is CompiledTransactionMessage & CompiledTransactionMessageWithLifetime {
  return "lifetimeToken" in message && Boolean(message.lifetimeToken);
}

function unsafe(reason: string) {
  return new LaunchError("unsafe_transaction", `Coook refused the transaction because ${reason}.`);
}
