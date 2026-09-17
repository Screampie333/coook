/**
 * Aturan input fitur Cook. Dipakai di browser (form) DAN di server (API route),
 * jadi file ini tidak boleh mengimpor apa pun yang khusus server.
 */

/** Panjang maksimal ide dari user. */
export const IDEA_MAX_LENGTH = 200;

/** Jumlah caption yang dihasilkan setiap kali Cook. */
export const CAPTION_COUNT = 3;

/** Merapikan ide: karakter kontrol dan spasi/baris baru berlebih jadi satu spasi. */
export function normalizeIdea(idea: string) {
  return idea.replace(/[\p{Cc}\s]+/gu, " ").trim();
}
