import "server-only";

import {
  AiError,
  type GenerateTextInput,
  type GenerateTextResult,
  type TextProvider,
} from "../types";

/**
 * Provider teks Groq (API kompatibel OpenAI).
 * Docs: https://console.groq.com/docs/api-reference#chat-create
 */

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Model production yang tersedia di free tier Groq (console.groq.com/docs/rate-limits, Sept 2026):
 * 30 request/menit, 8K token/menit, 1K request/hari, 200K token/hari.
 * Bisa diganti lewat GROQ_TEXT_MODEL, tapi model itu harus mendukung
 * strict JSON schema + reasoning_effort (saat ini: openai/gpt-oss-120b, openai/gpt-oss-20b).
 */
const DEFAULT_MODEL = "openai/gpt-oss-120b";

const TIMEOUT_MS = 20_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;

type GroqChatResponse = {
  model?: string;
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

async function generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new AiError("config", "GROQ_API_KEY is missing.");
  }
  const model = process.env.GROQ_TEXT_MODEL?.trim() || DEFAULT_MODEL;

  const body = {
    model,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.prompt },
    ],
    max_completion_tokens: input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    // GPT-OSS "berpikir" dulu sebelum menjawab. Token berpikir ikut dihitung ke rate limit,
    // jadi dibuat rendah, dan tidak dikirim balik karena kita tidak memakainya.
    reasoning_effort: "low",
    include_reasoning: false,
    ...(input.json && {
      response_format: {
        type: "json_schema",
        // strict: true = Groq memaksa jawaban cocok dengan skema (constrained decoding).
        json_schema: { name: input.json.name, strict: true, schema: input.json.schema },
      },
    }),
  };

  let response: Response;
  try {
    response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw toNetworkError(error);
  }

  if (!response.ok) {
    throw await toHttpError(response);
  }

  let data: GroqChatResponse;
  try {
    data = (await response.json()) as GroqChatResponse;
  } catch (error) {
    if (isTimeout(error)) throw toNetworkError(error);
    throw new AiError("bad_output", "Groq returned a response that is not JSON.", { cause: error });
  }

  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") {
    throw new AiError("bad_output", "Groq answer was cut off (max_completion_tokens reached).");
  }

  const text = choice?.message?.content;
  if (typeof text !== "string" || text.trim() === "") {
    throw new AiError("bad_output", "Groq returned an empty answer.");
  }

  return {
    text,
    provider: "groq",
    model: data.model ?? model,
    usage: data.usage
      ? {
          inputTokens: data.usage.prompt_tokens ?? 0,
          outputTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      : null,
  };
}

function isTimeout(error: unknown) {
  return (error as { name?: unknown } | null)?.name === "TimeoutError";
}

function toNetworkError(error: unknown) {
  if (isTimeout(error)) {
    return new AiError("timeout", `Groq did not answer within ${TIMEOUT_MS / 1000}s.`, { cause: error });
  }
  return new AiError("unavailable", "Could not reach Groq.", { cause: error });
}

async function toHttpError(response: Response) {
  const status = response.status;
  const detail = await readErrorMessage(response);

  // Rate limit: https://console.groq.com/docs/rate-limits
  if (status === 429) {
    return new AiError("rate_limited", `Groq rate limit reached: ${detail}`, {
      retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")),
    });
  }
  if (status === 401 || status === 403) {
    return new AiError("config", `Groq rejected the API key (${status}): ${detail}`);
  }
  // 498 = kapasitas flex tier penuh, 5xx = masalah di server Groq.
  if (status === 498 || status >= 500) {
    return new AiError("unavailable", `Groq is unavailable (${status}): ${detail}`);
  }
  return new AiError("provider_error", `Groq request failed (${status}): ${detail}`);
}

/** Format error Groq: { "error": { "message": "...", "type": "..." } } */
async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    if (typeof body.error?.message === "string") {
      return body.error.message.slice(0, 300);
    }
  } catch {
    // Body bukan JSON. Pakai status text saja.
  }
  return response.statusText || "no details";
}

/** Header retry-after dari Groq berisi jumlah detik. */
function parseRetryAfter(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : undefined;
}

export const groqProvider: TextProvider = {
  name: "groq",
  generateText,
};
