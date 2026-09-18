import "server-only";

import { generateKeyPair, getAddressFromPublicKey } from "@solana/kit";

/**
 * Keypair untuk alamat koin (mint) yang baru.
 *
 * Kunci ini dibuat di server, dipakai sekali untuk menandatangani transaksi pembuatan koin,
 * lalu dibuang begitu permintaan selesai. Kunci ini TIDAK PERNAH dikirim ke browser
 * dan tidak pernah disimpan di database.
 *
 * Catatan keamanan: generateKeyPair() membuat kunci "non-extractable" di WebCrypto,
 * jadi isinya memang tidak bisa dibaca keluar dari proses ini, bahkan oleh kode kita sendiri.
 */

export type MintKeyPair = {
  /** Dipakai untuk menandatangani transaksi. */
  keyPair: CryptoKeyPair;
  /** Alamat koin (base58). Ini yang jadi contract address di pump.fun. */
  address: string;
};

export async function createMintKeyPair(): Promise<MintKeyPair> {
  const keyPair = await generateKeyPair();
  const address = await getAddressFromPublicKey(keyPair.publicKey);
  return { keyPair, address };
}
