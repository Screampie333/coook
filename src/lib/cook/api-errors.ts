import "server-only";

import { NextResponse } from "next/server";
import { AiError } from "@/lib/ai";
import { DatabaseError } from "@/lib/db/errors";
import { LaunchError } from "@/lib/launch/types";
import { nextUtcMidnight } from "./limits";

/**
 * Format error semua API Cook:
 *   { "error": "pesan untuk user", "code": "...", ...info tambahan }
 * Detail teknis hanya dicatat di log server, tidak dikirim ke browser.
 */

export const RATE_LIMIT_MESSAGE = "The kitchen is packed right now. Try again in a moment.";

/** Kuota gratis harian provider gambar (Cloudflare: 10.000 neuron) habis. Reset jam 00:00 UTC. */
export function ovenOutOfGasResponse(extra: Record<string, unknown> = {}) {
  return errorResponse(
    503,
    "quota_exhausted",
    "The oven is out of gas for today. Cooking comes back after the daily reset.",
    { resetsAt: nextUtcMidnight().toISOString(), ...extra },
  );
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
  headers?: HeadersInit,
) {
  return NextResponse.json({ error: message, code, ...extra }, { status, headers });
}

/**
 * Ada pengaturan server yang belum diisi (env kosong).
 *
 * Nama variabelnya hanya ikut ditampilkan saat development, supaya saat ngoding
 * langsung ketahuan apa yang kurang tanpa harus membuka terminal. Di production
 * user cuma melihat pesan umum, karena isi pengaturan server bukan urusan mereka.
 */
export function setupErrorResponse(logLabel: string, missing: string, whatIsBroken: string) {
  console.error(`[${logLabel}] ${missing} is missing.`);

  const message =
    process.env.NODE_ENV === "production"
      ? `${whatIsBroken} isn't set up yet. Try again later.`
      : `${whatIsBroken} isn't set up yet: ${missing} is missing from .env.local.`;

  return errorResponse(500, "server_error", message);
}

/**
 * Mengubah error fitur Serve jadi respons HTTP.
 * Error selain LaunchError diteruskan ke aiErrorResponse.
 *
 * Beberapa pesan LaunchError memang ditulis untuk dibaca user (saldo kurang, isi ditolak,
 * transaksi mencurigakan), jadi pesannya diteruskan apa adanya.
 */
export function launchErrorResponse(error: unknown, logLabel: string, extra: Record<string, unknown> = {}) {
  if (!(error instanceof LaunchError)) {
    return aiErrorResponse(error, logLabel, extra);
  }

  if (error.code === "rate_limited") {
    const retryAfter = error.retryAfterSeconds;
    return errorResponse(
      429,
      "rate_limited",
      RATE_LIMIT_MESSAGE,
      { retryAfterSeconds: retryAfter ?? null, ...extra },
      retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
    );
  }

  console.error(`[${logLabel}] ${error.code}: ${error.message}`);

  switch (error.code) {
    // Pesan-pesan ini aman dan berguna untuk ditampilkan ke user.
    case "insufficient_funds":
      return errorResponse(402, "insufficient_funds", error.message, extra);
    case "rejected_content":
      return errorResponse(422, "rejected_content", error.message, extra);
    case "unsafe_transaction":
      return errorResponse(502, "unsafe_transaction", error.message, extra);
    case "rejected":
      return errorResponse(422, "transaction_rejected", error.message, extra);

    case "timeout":
      return errorResponse(504, "serve_timeout", "Solana is taking too long. Try again.", extra);
    case "unavailable":
      return errorResponse(503, "serve_unavailable", "Can't reach Solana right now. Try again soon.", extra);
    case "config":
      return errorResponse(500, "server_error", "Serving coins isn't set up yet. Try again later.", extra);
    default:
      return errorResponse(502, "serve_failed", "Couldn't serve that meme as a coin. Try again.", extra);
  }
}

/** Mengubah error dari AI, database, atau error tak terduga jadi respons HTTP. */
export function aiErrorResponse(error: unknown, logLabel: string, extra: Record<string, unknown> = {}) {
  if (error instanceof DatabaseError) {
    console.error(`[${logLabel}] database: ${error.message}`);
    return errorResponse(503, "database_error", "The kitchen's notebook is unavailable. Try again.", extra);
  }

  if (!(error instanceof AiError)) {
    console.error(`[${logLabel}] unexpected error`, error);
    return errorResponse(500, "server_error", "Something went wrong. Try again.", extra);
  }

  if (error.code === "rate_limited") {
    const retryAfter = error.retryAfterSeconds;
    return errorResponse(
      429,
      "rate_limited",
      RATE_LIMIT_MESSAGE,
      { retryAfterSeconds: retryAfter ?? null, ...extra },
      retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
    );
  }

  console.error(`[${logLabel}] ${error.code}: ${error.message}`);

  switch (error.code) {
    case "quota_exhausted":
      return ovenOutOfGasResponse(extra);
    case "timeout":
      return errorResponse(504, "ai_timeout", "The stove is taking too long. Try again.", extra);
    case "unavailable":
      return errorResponse(503, "ai_unavailable", "The kitchen is closed for a moment. Try again soon.", extra);
    case "config":
      return errorResponse(500, "server_error", "The kitchen isn't set up yet. Try again later.", extra);
    default:
      return errorResponse(502, "ai_failed", "The kitchen burned that one. Try again.", extra);
  }
}
