import "server-only";

import { z } from "zod";
import { AiError, type ModerationInput, type ModerationProvider, type ModerationResult } from "../types";

/**
 * Filter isi memakai Groq (gpt-oss-safeguard-20b), gratis di free tier.
 * Docs: https://console.groq.com/docs/model/openai/gpt-oss-safeguard-20b
 *
 * KETERBATASAN: model ini hanya membaca TEKS, tidak bisa memeriksa gambar.
 * Untuk Kuk ini masih cukup karena gambar meme selalu dibuat lewat prompt
 * kita sendiri (lib/cook/scene.ts), bukan diunggah bebas oleh user — jadi
 * bagian paling berisiko sebelum sebuah meme jadi koin publik memang di teks:
 * nama koin, ticker, deskripsi, dan caption tulisan bebas user.
 */

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-safeguard-20b";
const TIMEOUT_MS = 15_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 400;

/** Batas panjang teks yang diperiksa, supaya permintaan tidak membengkak. */
const MAX_TEXT_LENGTH = 2_000;

const CATEGORIES = [
  "sexual",
  "sexual/minors",
  "hate",
  "harassment",
  "violence",
  "violence/graphic",
  "self-harm",
  "illegal",
] as const;

/**
 * Kebijakan ditulis mengikuti format yang disarankan Groq untuk gpt-oss-safeguard:
 * INSTRUCTIONS, Definitions, Criteria, lalu Examples.
 */
const POLICY = `INSTRUCTIONS
You are a content safety filter for Kuk, a website that turns user ideas into memes and can
publish the result as a public, permanent cryptocurrency coin on Solana. Decide whether the text
given by the user is safe to publish permanently and publicly as a coin's name, ticker,
description, or caption.

Definitions
- sexual: content meant to arouse sexual excitement or describing sexual acts.
- sexual/minors: any sexual content involving anyone under 18.
- hate: content that attacks or demeans people based on race, ethnicity, religion, gender,
  sexual orientation, disability, or similar protected traits.
- harassment: content that bullies, threatens, or targets a specific person or group.
- violence: content that celebrates, threatens, or calls for violence.
- violence/graphic: graphic descriptions of death, gore, or injury.
- self-harm: content that encourages or gives instructions for suicide or self-harm.
- illegal: instructions or clear encouragement to commit a crime (weapons, drugs, fraud, etc).

Criteria
Flag the text if it fits ANY definition above. Ordinary crypto slang, jokes, exaggeration, and
memes about gains/losses ("to the moon", "rug", "ape in") are NOT violations by themselves.
Only flag when the text goes beyond joking crypto culture into one of the categories above.

Examples
- "grandma ape'd her pension into $DOGE" -> safe, no categories.
- "nuke every trader who sells early" -> violence.
- Empty or meaningless text -> safe, no categories.

Respond with the categories (if any) that this text violates.`;

const outputSchema = z.object({
  flagged: z.boolean(),
  categories: z.array(z.enum(CATEGORIES)),
});

type GroqChatResponse = {
  model?: string;
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
};

async function moderate(input: ModerationInput): Promise<ModerationResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new AiError("config", "GROQ_API_KEY is missing.");
  }

  const text = input.texts
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n---\n")
    .slice(0, MAX_TEXT_LENGTH);

  // Gambar tidak bisa diperiksa provider ini (lihat catatan keterbatasan di atas).
  if (!text) {
    return { flagged: false, categories: [], provider: "groq", model: MODEL };
  }

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: POLICY },
      { role: "user", content: text },
    ],
    max_completion_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
    reasoning_effort: "low",
    include_reasoning: false,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "content_moderation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            flagged: { type: "boolean" },
            categories: { type: "array", items: { type: "string", enum: CATEGORIES } },
          },
          required: ["flagged", "categories"],
          additionalProperties: false,
        },
      },
    },
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
    throw new AiError("bad_output", "Groq moderation answer was cut off (max_completion_tokens reached).");
  }

  const raw = choice?.message?.content;
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new AiError("bad_output", "Groq returned an empty moderation answer.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new AiError("bad_output", "Groq moderation answer is not valid JSON.", { cause: error });
  }

  const result = outputSchema.safeParse(parsed);
  if (!result.success) {
    throw new AiError("bad_output", `Groq moderation answer did not match the expected shape: ${result.error.message}`);
  }

  return {
    flagged: result.data.flagged,
    categories: result.data.categories,
    provider: "groq",
    model: data.model ?? MODEL,
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

  if (status === 429) {
    return new AiError("rate_limited", `Groq rate limit reached: ${detail}`, {
      retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")),
    });
  }
  if (status === 401 || status === 403) {
    return new AiError("config", `Groq rejected the API key (${status}): ${detail}`);
  }
  if (status === 498 || status >= 500) {
    return new AiError("unavailable", `Groq is unavailable (${status}): ${detail}`);
  }
  return new AiError("provider_error", `Groq moderation request failed (${status}): ${detail}`);
}

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

function parseRetryAfter(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : undefined;
}

export const groqModerationProvider: ModerationProvider = {
  name: "groq",
  moderate,
  isConfigured: () => Boolean(process.env.GROQ_API_KEY?.trim()),
};
