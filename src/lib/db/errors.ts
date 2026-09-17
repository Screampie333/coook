import "server-only";

/** Dilempar kalau query ke Supabase gagal. Detailnya hanya untuk log server. */
export class DatabaseError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "DatabaseError";
  }
}

/** Menulis error ke log dengan detail dari Supabase, lalu melempar DatabaseError. */
export function throwDatabaseError(what: string, cause: unknown): never {
  console.error(`[db] ${what}:`, cause);
  throw new DatabaseError(what, cause);
}
