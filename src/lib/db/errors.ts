import "server-only";

/** Dilempar kalau query ke Supabase gagal. Detailnya hanya untuk log server. */
export class DatabaseError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "DatabaseError";
  }
}

/** Batas panjang detail error yang ditulis ke log. */
const MAX_LOG_DETAIL = 300;

/**
 * Merapikan detail error Supabase untuk log.
 *
 * Pesan Postgres ikut memuat nilai yang ditolaknya. Kalau ada yang mengirim
 * teks 5000 karakter lewat URL, seluruhnya akan tertulis ke log server.
 * Dipotong supaya log tetap terbaca dan tidak bisa dibanjiri dari luar.
 */
function summarize(cause: unknown) {
  if (cause && typeof cause === "object") {
    const e = cause as { code?: unknown; message?: unknown };
    const code = typeof e.code === "string" ? e.code : "?";
    const message = typeof e.message === "string" ? e.message.slice(0, MAX_LOG_DETAIL) : "";
    return `${code} ${message}`.trim();
  }
  return String(cause).slice(0, MAX_LOG_DETAIL);
}

/** Menulis error ke log dengan detail dari Supabase, lalu melempar DatabaseError. */
export function throwDatabaseError(what: string, cause: unknown): never {
  console.error(`[db] ${what}: ${summarize(cause)}`);
  throw new DatabaseError(what, cause);
}
