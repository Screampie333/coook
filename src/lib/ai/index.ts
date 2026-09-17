import "server-only";

import { cloudflareImageProvider } from "./providers/cloudflare";
import { groqProvider } from "./providers/groq";
import {
  AiError,
  type GenerateImageInput,
  type GenerateImageResult,
  type GenerateTextInput,
  type GenerateTextResult,
  type ImageProvider,
  type TextProvider,
} from "./types";

/**
 * Pintu masuk AI untuk seluruh aplikasi.
 *
 * Kode fitur cukup memanggil generateText() atau generateImage(). Provider dipilih lewat env:
 *   AI_TEXT_PROVIDER=groq         (default)
 *   AI_IMAGE_PROVIDER=cloudflare  (default)
 *
 * Menambah provider baru (misalnya gemini untuk teks):
 *   1. Buat src/lib/ai/providers/gemini.ts yang mengekspor TextProvider.
 *   2. Daftarkan di TEXT_PROVIDERS di bawah.
 * Kode fitur tidak perlu diubah.
 */

const DEFAULT_TEXT_PROVIDER = "groq";
const DEFAULT_IMAGE_PROVIDER = "cloudflare";

const TEXT_PROVIDERS = new Map<string, TextProvider>([[groqProvider.name, groqProvider]]);

const IMAGE_PROVIDERS = new Map<string, ImageProvider>([
  [cloudflareImageProvider.name, cloudflareImageProvider],
]);

function pickProvider<T>(providers: Map<string, T>, envName: string, fallback: string): T {
  const name = process.env[envName]?.trim().toLowerCase() || fallback;
  const provider = providers.get(name);
  if (!provider) {
    const available = [...providers.keys()].join(", ");
    throw new AiError("config", `${envName} "${name}" is not available yet. Available: ${available}.`);
  }
  return provider;
}

export function getTextProvider(): TextProvider {
  return pickProvider(TEXT_PROVIDERS, "AI_TEXT_PROVIDER", DEFAULT_TEXT_PROVIDER);
}

export function getImageProvider(): ImageProvider {
  return pickProvider(IMAGE_PROVIDERS, "AI_IMAGE_PROVIDER", DEFAULT_IMAGE_PROVIDER);
}

export async function generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
  return getTextProvider().generateText(input);
}

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  return getImageProvider().generateImage(input);
}

export { AiError } from "./types";
export type {
  AiErrorCode,
  GenerateImageInput,
  GenerateImageResult,
  GenerateTextInput,
  GenerateTextResult,
  JsonOutput,
  TokenUsage,
} from "./types";
