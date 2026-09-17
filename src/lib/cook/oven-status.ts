import "server-only";

import { utcDay } from "./limits";

/**
 * Catatan "kuota gratis provider gambar habis hari ini" (Cloudflare error 3036).
 * Disimpan di memori server saja, karena ini hanya pintasan supaya Cook berikutnya
 * ditolak cepat tanpa memakai token AI teks. Kalau catatannya hilang (server restart),
 * paling buruk satu Cook lagi menabrak error yang sama dari Cloudflare.
 */

const globalStore = globalThis as typeof globalThis & { __coookOvenOutOfGasDay?: string };

export function markImageProviderExhausted(now = new Date()) {
  globalStore.__coookOvenOutOfGasDay = utcDay(now);
}

export function isImageProviderExhausted(now = new Date()) {
  return globalStore.__coookOvenOutOfGasDay === utcDay(now);
}
