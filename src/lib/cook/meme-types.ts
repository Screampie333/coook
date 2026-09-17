/**
 * Bentuk data meme yang dipakai bersama server dan browser (galeri, kitchen, hasil Cook).
 * File ini hanya berisi tipe, jadi aman diimpor dari mana saja.
 */

export type MemeSummary = {
  id: string;
  /** URL gambar polos di Supabase Storage. */
  imageUrl: string;
  /** 3 caption dari AI. */
  captions: string[];
  /** Caption AI yang dipilih pembuatnya saat Download. null = tanpa caption. */
  captionIndex: number | null;
  /** Ide user. Hanya diisi untuk pemilik meme; di galeri publik selalu null. */
  idea: string | null;
  loreId: string | null;
  loreName: string | null;
  walletAddress: string;
  createdAt: string;
};

export type LaunchSummary = {
  id: string;
  mintAddress: string;
  name: string;
  ticker: string;
  memeId: string;
  createdAt: string;
};
