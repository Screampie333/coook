import "server-only";

import { cloudflareImageProvider } from "./providers/cloudflare";
import { groqProvider } from "./providers/groq";
import { openaiModerationProvider } from "./providers/openai-moderation";
import {
  AiError,
  type GenerateImageInput,
  type GenerateImageResult,
  type GenerateTextInput,
  type GenerateTextResult,
  type ImageProvider,
  type ModerationInput,
  type ModerationProvider,
  type ModerationResult,
  type TextProvider,
} from "./types";

/**
 * Pintu masuk AI untuk seluruh aplikasi.
 *
 * Kode fitur cukup memanggil generateText(), generateImage(), atau moderateContent().
 * Provider dipilih lewat env:
 *   AI_TEXT_PROVIDER=groq          (default)
 *   AI_IMAGE_PROVIDER=cloudflare   (default)
 *   AI_MODERATION_PROVIDER=openai  (default)
 *
 * Menambah provider baru (misalnya gemini untuk teks):
 *   1. Buat src/lib/ai/providers/gemini.ts yang mengekspor TextProvider.
 *   2. Daftarkan di TEXT_PROVIDERS di bawah.
 * Kode fitur tidak perlu diubah.
 */

const DEFAULT_TEXT_PROVIDER = "groq";
const DEFAULT_IMAGE_PROVIDER = "cloudflare";
const DEFAULT_MODERATION_PROVIDER = "openai";

const TEXT_PROVIDERS = new Map<string, TextProvider>([[groqProvider.name, groqProvider]]);

const IMAGE_PROVIDERS = new Map<string, ImageProvider>([
  [cloudflareImageProvider.name, cloudflareImageProvider],
]);

const MODERATION_PROVIDERS = new Map<string, ModerationProvider>([
  [openaiModerationProvider.name, openaiModerationProvider],
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

export function getModerationProvider(): ModerationProvider {
  return pickProvider(MODERATION_PROVIDERS, "AI_MODERATION_PROVIDER", DEFAULT_MODERATION_PROVIDER);
}

/** true kalau filter isi sudah diatur. Dipakai untuk memberi pesan yang jelas lebih awal. */
export function isModerationConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
  return getTextProvider().generateText(input);
}

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  return getImageProvider().generateImage(input);
}

/** Memeriksa teks dan gambar sebelum diterbitkan ke tempat yang permanen (IPFS, pump.fun). */
export async function moderateContent(input: ModerationInput): Promise<ModerationResult> {
  return getModerationProvider().moderate(input);
}

export { AiError } from "./types";
export type {
  AiErrorCode,
  GenerateImageInput,
  GenerateImageResult,
  GenerateTextInput,
  GenerateTextResult,
  JsonOutput,
  ModerationInput,
  ModerationResult,
  TokenUsage,
} from "./types";
