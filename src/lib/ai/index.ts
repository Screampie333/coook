import "server-only";

import { groqProvider } from "./providers/groq";
import {
  AiError,
  type GenerateTextInput,
  type GenerateTextResult,
  type TextProvider,
} from "./types";

/**
 * Pintu masuk AI teks untuk seluruh aplikasi.
 *
 * Kode fitur cukup memanggil generateText(). Provider dipilih lewat env:
 *   AI_TEXT_PROVIDER=groq   (default)
 *
 * Menambah provider baru (misalnya gemini):
 *   1. Buat src/lib/ai/providers/gemini.ts yang mengekspor TextProvider.
 *   2. Daftarkan di TEXT_PROVIDERS di bawah.
 * Kode fitur tidak perlu diubah.
 */

const DEFAULT_TEXT_PROVIDER = "groq";

const TEXT_PROVIDERS = new Map<string, TextProvider>([[groqProvider.name, groqProvider]]);

export function getTextProvider(): TextProvider {
  const name = process.env.AI_TEXT_PROVIDER?.trim().toLowerCase() || DEFAULT_TEXT_PROVIDER;
  const provider = TEXT_PROVIDERS.get(name);
  if (!provider) {
    const available = [...TEXT_PROVIDERS.keys()].join(", ");
    throw new AiError(
      "config",
      `AI_TEXT_PROVIDER "${name}" is not available yet. Available: ${available}.`,
    );
  }
  return provider;
}

export async function generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
  return getTextProvider().generateText(input);
}

export { AiError } from "./types";
export type {
  AiErrorCode,
  GenerateTextInput,
  GenerateTextResult,
  JsonOutput,
  TokenUsage,
} from "./types";
