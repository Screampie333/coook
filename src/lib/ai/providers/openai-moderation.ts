import "server-only";

import { AiError, type ModerationInput, type ModerationProvider, type ModerationResult } from "../types";

/**
 * Filter isi memakai OpenAI Moderation.
 * Docs: https://platform.openai.com/docs/api-reference/moderations
 *
 * Endpoint ini gratis. Model omni-moderation bisa memeriksa teks DAN gambar
 * dalam satu panggilan, jadi sebelum sebuah meme jadi koin publik, gambarnya
 * dan semua teksnya diperiksa sekaligus.
 */

const MODERATION_URL = "https://api.openai.com/v1/moderations";
const DEFAULT_MODEL = "omni-moderation-latest";
const TIMEOUT_MS = 15_000;

/** Batas panjang teks per bagian, supaya permintaan tidak membengkak. */
const MAX_TEXT_LENGTH = 2_000;

type ModerationResponse = {
  model?: string;
  results?: Array<{
    flagged?: unknown;
    categories?: Record<string, unknown>;
  }>;
};

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function moderate(input: ModerationInput): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiError("config", "OPENAI_API_KEY is missing.");
  }
  const model = process.env.OPENAI_MODERATION_MODEL?.trim() || DEFAULT_MODEL;

  const parts: ContentPart[] = [];
  for (const text of input.texts) {
    const value = text.trim();
    if (value) parts.push({ type: "text", text: value.slice(0, MAX_TEXT_LENGTH) });
  }
  if (input.imageUrl) {
    parts.push({ type: "image_url", image_url: { url: input.imageUrl } });
  }

  if (parts.length === 0) {
    return { flagged: false, categories: [], provider: "openai", model };
  }

  let response: Response;
  try {
    response = await fetch(MODERATION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input: parts }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw toNetworkError(error);
  }

  if (!response.ok) {
    throw await toHttpError(response);
  }

  let data: ModerationResponse;
  try {
    data = (await response.json()) as ModerationResponse;
  } catch (error) {
    if (isTimeout(error)) throw toNetworkError(error);
    throw new AiError("bad_output", "OpenAI returned a response that is not JSON.", { cause: error });
  }

  const results = data.results;
  if (!Array.isArray(results) || results.length === 0) {
    throw new AiError("bad_output", "OpenAI returned no moderation result.");
  }

  const categories = new Set<string>();
  let flagged = false;
  for (const result of results) {
    if (result.flagged === true) flagged = true;
    for (const [name, value] of Object.entries(result.categories ?? {})) {
      if (value === true) categories.add(name);
    }
  }

  return { flagged, categories: [...categories], provider: "openai", model: data.model ?? model };
}

function isTimeout(error: unknown) {
  return (error as { name?: unknown } | null)?.name === "TimeoutError";
}

function toNetworkError(error: unknown) {
  if (isTimeout(error)) {
    return new AiError("timeout", `OpenAI did not answer within ${TIMEOUT_MS / 1000}s.`, { cause: error });
  }
  return new AiError("unavailable", "Could not reach OpenAI.", { cause: error });
}

async function toHttpError(response: Response) {
  const status = response.status;
  let detail = response.statusText || "no details";
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    if (typeof body.error?.message === "string") detail = body.error.message.slice(0, 300);
  } catch {
    // Body bukan JSON. Pakai status text saja.
  }

  if (status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    return new AiError("rate_limited", `OpenAI rate limit reached: ${detail}`, {
      retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : undefined,
    });
  }
  if (status === 401 || status === 403) {
    return new AiError("config", `OpenAI rejected the API key (${status}): ${detail}`);
  }
  if (status >= 500) {
    return new AiError("unavailable", `OpenAI is unavailable (${status}): ${detail}`);
  }
  return new AiError("provider_error", `OpenAI moderation failed (${status}): ${detail}`);
}

export const openaiModerationProvider: ModerationProvider = {
  name: "openai",
  moderate,
};
