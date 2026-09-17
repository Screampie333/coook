import "server-only";

import {
  AiError,
  type GenerateImageInput,
  type GenerateImageResult,
  type ImageProvider,
} from "../types";

/**
 * Provider gambar Cloudflare Workers AI (REST API).
 * Docs model: https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
 *
 * Model ini hanya menerima `prompt` (maks 2048 karakter) dan `steps` (maks 8, default 4).
 * Ukuran gambar tidak bisa diatur.
 * Biaya: 4,80 neuron per tile 512x512 + 9,60 neuron per step. Gratis 10.000 neuron/hari (reset 00:00 UTC).
 */

const MODEL = "@cf/black-forest-labs/flux-1-schnell";
const PROMPT_MAX_LENGTH = 2048;
const DEFAULT_STEPS = 4;
const MAX_STEPS = 8;
const TIMEOUT_MS = 30_000;

// Kode error resmi: https://developers.cloudflare.com/workers-ai/platform/errors/
const ERROR_DAILY_FREE_LIMIT = 3036;
const ERROR_OUT_OF_CAPACITY = 3040;
const ERROR_TIMEOUT = 3007;
const ERROR_ABORTED = 3008;

type CloudflareResponse = {
  success?: boolean;
  result?: { image?: unknown };
  errors?: Array<{ code?: unknown; message?: unknown }>;
};

async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !apiToken) {
    throw new AiError("config", "CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is missing.");
  }

  const prompt = input.prompt.trim().slice(0, PROMPT_MAX_LENGTH);
  if (!prompt) throw new AiError("provider_error", "Image prompt is empty.");

  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, steps: resolveSteps(input.steps) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw toNetworkError(error);
  }

  let body: CloudflareResponse | null = null;
  try {
    body = (await response.json()) as CloudflareResponse;
  } catch (error) {
    if (isTimeout(error)) throw toNetworkError(error);
    // Body bukan JSON. Ditangani di bawah berdasarkan status HTTP.
  }

  if (response.ok && !body) {
    throw new AiError("bad_output", "Cloudflare returned a response that is not JSON.");
  }
  if (!response.ok || !body || body.success === false) {
    throw toApiError(response, body);
  }

  const base64 = body.result?.image;
  if (typeof base64 !== "string" || base64.length === 0) {
    throw new AiError("bad_output", "Cloudflare returned no image.");
  }

  const data = Buffer.from(base64, "base64");
  const mimeType = detectImageType(data);
  if (!mimeType) {
    throw new AiError("bad_output", "Cloudflare returned data that is not a JPEG or PNG image.");
  }

  return { data, mimeType, provider: "cloudflare", model: MODEL };
}

/** Steps dari input, lalu env CLOUDFLARE_IMAGE_STEPS, lalu default 4. Harus bilangan bulat 1–8. */
function resolveSteps(requested?: number) {
  const candidates = [requested, Number(process.env.CLOUDFLARE_IMAGE_STEPS?.trim() || NaN)];
  for (const value of candidates) {
    if (value !== undefined && Number.isInteger(value) && value >= 1 && value <= MAX_STEPS) {
      return value;
    }
  }
  return DEFAULT_STEPS;
}

function detectImageType(data: Buffer): GenerateImageResult["mimeType"] | null {
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length > 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  return null;
}

function isTimeout(error: unknown) {
  return (error as { name?: unknown } | null)?.name === "TimeoutError";
}

function toNetworkError(error: unknown) {
  if (isTimeout(error)) {
    return new AiError("timeout", `Cloudflare did not answer within ${TIMEOUT_MS / 1000}s.`, { cause: error });
  }
  return new AiError("unavailable", "Could not reach Cloudflare.", { cause: error });
}

function toApiError(response: Response, body: CloudflareResponse | null) {
  const status = response.status;
  const errors = (body?.errors ?? []).map((error) => ({
    code: typeof error.code === "number" ? error.code : null,
    message: typeof error.message === "string" ? error.message.slice(0, 300) : "",
  }));
  const codes = errors.map((error) => error.code);
  const detail =
    errors.map((error) => `${error.code ?? "?"} ${error.message}`.trim()).join("; ") ||
    response.statusText ||
    "no details";

  if (codes.includes(ERROR_DAILY_FREE_LIMIT)) {
    return new AiError("quota_exhausted", `Cloudflare daily free neurons used up (${status}): ${detail}`);
  }
  if (status === 429 || codes.includes(ERROR_OUT_OF_CAPACITY)) {
    const retryAfter = Number(response.headers.get("retry-after"));
    return new AiError("rate_limited", `Cloudflare is busy (${status}): ${detail}`, {
      retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : undefined,
    });
  }
  if (status === 408 || codes.includes(ERROR_TIMEOUT) || codes.includes(ERROR_ABORTED)) {
    return new AiError("timeout", `Cloudflare timed out (${status}): ${detail}`);
  }
  if (status === 401 || status === 403) {
    // Token salah, izin kurang (butuh Workers AI Read + Edit), atau model butuh paket berbayar.
    return new AiError("config", `Cloudflare rejected the request (${status}): ${detail}`);
  }
  if (status >= 500) {
    return new AiError("unavailable", `Cloudflare is unavailable (${status}): ${detail}`);
  }
  return new AiError("provider_error", `Cloudflare request failed (${status}): ${detail}`);
}

export const cloudflareImageProvider: ImageProvider = {
  name: "cloudflare",
  generateImage,
};
