/**
 * Aturan fitur Cook. Dipakai di browser (form) DAN di server (API route),
 * jadi file ini tidak boleh mengimpor apa pun yang khusus server.
 */

/** Panjang maksimal ide dari user. */
export const IDEA_MAX_LENGTH = 200;

/** Jumlah caption yang dihasilkan setiap kali Cook. */
export const CAPTION_COUNT = 3;

/** Batas gambar meme per wallet per hari (reset 00:00 UTC). */
export const IMAGE_DAILY_LIMIT = 5;

/** Sisa jatah gambar meme sebuah wallet hari ini. */
export type ImageQuota = {
  used: number;
  limit: number;
  remaining: number;
  /** Waktu reset berikutnya (ISO, 00:00 UTC). */
  resetsAt: string;
};

/** Merapikan ide: karakter kontrol dan spasi/baris baru berlebih jadi satu spasi. */
export function normalizeIdea(idea: string) {
  return idea.replace(/[\p{Cc}\s]+/gu, " ").trim();
}

/** Mengecek bentuk data kuota yang diterima dari API. */
export function isImageQuota(value: unknown): value is ImageQuota {
  const quota = value as Partial<ImageQuota> | null;
  return (
    typeof quota?.used === "number" &&
    typeof quota.limit === "number" &&
    typeof quota.remaining === "number" &&
    typeof quota.resetsAt === "string"
  );
}
