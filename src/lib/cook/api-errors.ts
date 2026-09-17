import "server-only";

import { NextResponse } from "next/server";
import { AiError } from "@/lib/ai";
import { nextUtcMidnight } from "./image-quota";

/**
 * Format error semua API Cook:
 *   { "error": "pesan untuk user", "code": "...", ...info tambahan }
 * Detail teknis hanya dicatat di log server, tidak dikirim ke browser.
 */

export const RATE_LIMIT_MESSAGE = "The kitchen is packed right now. Try again in a moment.";

export function errorResponse(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
  headers?: HeadersInit,
) {
  return NextResponse.json({ error: message, code, ...extra }, { status, headers });
}

/** Mengubah error dari AI (atau error tak terduga) jadi respons HTTP. */
export function aiErrorResponse(error: unknown, logLabel: string, extra: Record<string, unknown> = {}) {
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
      // Kuota gratis harian provider (Cloudflare: 10.000 neuron) reset jam 00:00 UTC.
      return errorResponse(
        503,
        "quota_exhausted",
        "The oven is out of gas for today. Image cooking comes back after the daily reset.",
        { resetsAt: nextUtcMidnight().toISOString(), ...extra },
      );
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
