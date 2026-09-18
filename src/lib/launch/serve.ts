import "server-only";

import { LAUNCH } from "@/config/launch";
import { moderateContent } from "@/lib/ai";
import { renderMemeImage } from "@/lib/cook/render-server";
import { downloadMemeImage } from "@/lib/db/storage";
import { uploadCoinMetadata, type CoinMetadata } from "@/lib/ipfs/pinata";
import { prepareCreateTransaction, type PreparedCreateTransaction } from "./index";
import { LaunchError } from "./types";

/**
 * Langkah-langkah mengubah meme jadi koin, sampai transaksinya siap ditandatangani user.
 *
 * Urutannya penting:
 * 1. Periksa isinya dulu. Koin itu publik dan permanen, IPFS juga tidak bisa ditarik kembali.
 * 2. Baru gambar, upload, dan siapkan transaksi.
 * Kalau moderasi ditaruh belakangan, kita sudah terlanjur menerbitkan isinya ke IPFS.
 */

/** Semua teks yang akan ikut terbit bersama koin. */
export type CoinText = {
  name: string;
  /** Tanpa tanda $. */
  ticker: string;
  description: string;
  /** Caption yang digambar ke gambar koin. Kosong = tanpa caption. */
  caption: string;
};

/**
 * Menolak kalau ada teks yang tidak layak diterbitkan.
 * @throws LaunchError dengan code "rejected_content"
 */
export async function assertCoinTextIsAllowed(text: CoinText): Promise<void> {
  const result = await moderateContent({
    texts: [text.name, text.ticker, text.description, text.caption],
  });

  if (result.flagged) {
    // Kategori dicatat di log server saja, tidak dikirim ke browser.
    console.warn(`[serve] coin text rejected by moderation: ${result.categories.join(", ")}`);
    throw new LaunchError(
      "rejected_content",
      "That name, ticker, description, or caption can't be published as a coin. Try different wording.",
    );
  }
}

export type BuiltCoin = {
  prepared: PreparedCreateTransaction;
  metadata: CoinMetadata;
};

/**
 * Menggambar gambar koin, menerbitkannya ke IPFS, lalu menyiapkan transaksinya.
 * Panggil assertCoinTextIsAllowed() lebih dulu.
 */
export async function buildCoin(input: {
  wallet: string;
  memeId: string;
  /** Lokasi gambar polos di Supabase Storage. */
  imagePath: string;
  text: CoinText;
}): Promise<BuiltCoin> {
  // Gambar diambil dari database kita, bukan dari browser, lalu caption digambar di server.
  const picture = await downloadMemeImage(input.imagePath);
  const image = await renderMemeImage(picture, input.text.caption);

  const metadata = await uploadCoinMetadata({
    image: { data: image.data, mimeType: image.mimeType },
    name: input.text.name,
    ticker: input.text.ticker,
    description: input.text.description,
    slug: input.memeId,
  });

  const prepared = await prepareCreateTransaction({
    creator: input.wallet,
    name: input.text.name,
    ticker: input.text.ticker,
    metadataUri: metadata.metadataUri,
  });

  return { prepared, metadata };
}

/** Deskripsi bawaan kalau user tidak menulis apa-apa. */
export function defaultDescription(text: { name: string; caption: string }) {
  const line = text.caption.replace(/\s+/g, " ").trim();
  return line || `${text.name}, cooked at ${LAUNCH.websiteUrl}`;
}
