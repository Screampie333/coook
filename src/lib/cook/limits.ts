import { QUOTA } from "@/config/quota";

/**
 * Aturan fitur Cook. Dipakai di browser (form) DAN di server (API route),
 * jadi file ini tidak boleh mengimpor apa pun yang khusus server.
 */

/** Panjang maksimal ide dari user. */
export const IDEA_MAX_LENGTH = 200;

/** Jumlah caption yang dihasilkan setiap kali Cook. */
export const CAPTION_COUNT = 3;

/** Panjang maksimal caption yang ditulis user sendiri. */
export const CUSTOM_CAPTION_MAX_LENGTH = 120;

/** Batas gambar meme per wallet per hari. Diatur di src/config/quota.ts. */
export const IMAGE_DAILY_LIMIT = QUOTA.dailyImages;

/** Sisa jatah gambar meme sebuah wallet hari ini. */
export type ImageQuota = {
  used: number;
  limit: number;
  remaining: number;
  /** Waktu reset jatah berikutnya (ISO). */
  resetsAt: string;
};

const RESET_OFFSET_MS = QUOTA.resetUtcOffsetHours * 60 * 60 * 1000;

/**
 * Tanggal "hari kuota" di zona reset (WIB), misalnya "2026-09-18".
 * Dipakai sebagai kunci baris di tabel usage.
 */
export function quotaDay(now = new Date()) {
  return new Date(now.getTime() + RESET_OFFSET_MS).toISOString().slice(0, 10);
}

/** Waktu reset jatah berikutnya, yaitu 00:00 WIB berikutnya. */
export function nextQuotaReset(now = new Date()) {
  const shifted = new Date(now.getTime() + RESET_OFFSET_MS);
  const nextMidnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1);
  return new Date(nextMidnight - RESET_OFFSET_MS);
}

/** Tanggal UTC hari ini. Khusus untuk kuota neuron Cloudflare, yang resetnya 00:00 UTC. */
export function utcDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** Waktu 00:00 UTC berikutnya (reset kuota gratis Cloudflare). */
export function nextUtcMidnight(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

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
