/**
 * Aturan kuota generate harian. Ini satu-satunya tempat yang perlu diubah.
 *
 * Catatan: `resetUtcOffsetHours` harus sama dengan angka di fungsi database
 * (lihat supabase/migrations/0002_quota_reset_wib.sql). Kalau diubah di sini,
 * ubah juga di sana lalu jalankan SQL-nya lagi.
 */
export const QUOTA = {
  /** Jatah gambar per wallet per hari. */
  dailyImages: 5,

  /** Jam reset sebagai selisih dari UTC. WIB = +7, jadi jatah reset tiap 00:00 WIB. */
  resetUtcOffsetHours: 7,
};

// Dicek saat server mulai, supaya salah ketik langsung ketahuan.
if (!Number.isInteger(QUOTA.dailyImages) || QUOTA.dailyImages < 1) {
  throw new Error("src/config/quota.ts: dailyImages harus bilangan bulat minimal 1.");
}
if (!Number.isInteger(QUOTA.resetUtcOffsetHours) || Math.abs(QUOTA.resetUtcOffsetHours) > 14) {
  throw new Error("src/config/quota.ts: resetUtcOffsetHours harus bilangan bulat antara -14 dan 14.");
}
