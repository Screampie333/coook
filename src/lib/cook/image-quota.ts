import "server-only";

import { IMAGE_DAILY_LIMIT, type ImageQuota } from "./limits";

/**
 * SEMENTARA: batas gambar per wallet per hari, disimpan di memori server.
 *
 * Keterbatasan (akan diganti Supabase):
 * - Hitungan hilang kalau server restart.
 * - Di Vercel, setiap server punya hitungannya sendiri.
 *
 * Hari dihitung dalam UTC, jadi reset jam 00:00 UTC, sama dengan kuota neuron Cloudflare.
 */

type DayCounter = { day: string; used: Map<string, number> };

/** Tanda bukti jatah yang sudah dipotong, dipakai untuk mengembalikan jatah kalau gagal. */
export type ImageReservation = { wallet: string; day: string };

// Disimpan di globalThis supaya tidak ter-reset setiap kali kode di-reload saat development.
const globalStore = globalThis as typeof globalThis & { __coookImageQuota?: DayCounter };

function utcDay(now: Date) {
  return now.toISOString().slice(0, 10);
}

/** Waktu 00:00 UTC berikutnya. */
export function nextUtcMidnight(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function counterFor(now: Date) {
  const day = utcDay(now);
  if (globalStore.__coookImageQuota?.day !== day) {
    // Hari baru: semua hitungan kembali nol.
    globalStore.__coookImageQuota = { day, used: new Map() };
  }
  return globalStore.__coookImageQuota;
}

function toQuota(used: number, now: Date): ImageQuota {
  return {
    used,
    limit: IMAGE_DAILY_LIMIT,
    remaining: Math.max(0, IMAGE_DAILY_LIMIT - used),
    resetsAt: nextUtcMidnight(now).toISOString(),
  };
}

export function getImageQuota(wallet: string, now = new Date()): ImageQuota {
  return toQuota(counterFor(now).used.get(wallet) ?? 0, now);
}

/**
 * Memotong 1 jatah SEBELUM gambar dibuat, supaya klik beruntun tidak bisa melewati batas.
 * Kalau pembuatan gagal, panggil refundImage().
 */
export function reserveImage(
  wallet: string,
  now = new Date(),
): { ok: true; reservation: ImageReservation; quota: ImageQuota } | { ok: false; quota: ImageQuota } {
  const counter = counterFor(now);
  const used = counter.used.get(wallet) ?? 0;
  if (used >= IMAGE_DAILY_LIMIT) {
    return { ok: false, quota: toQuota(used, now) };
  }
  counter.used.set(wallet, used + 1);
  return { ok: true, reservation: { wallet, day: counter.day }, quota: toQuota(used + 1, now) };
}

/** Mengembalikan jatah yang dipotong reserveImage(). Tidak berbuat apa-apa kalau harinya sudah berganti. */
export function refundImage(reservation: ImageReservation, now = new Date()): ImageQuota {
  const counter = counterFor(now);
  if (counter.day === reservation.day) {
    const used = counter.used.get(reservation.wallet) ?? 0;
    counter.used.set(reservation.wallet, Math.max(0, used - 1));
  }
  return getImageQuota(reservation.wallet, now);
}
