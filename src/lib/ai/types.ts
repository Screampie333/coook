/**
 * Tipe bersama untuk semua provider AI teks (Groq, nanti Gemini / OpenAI).
 * Kode fitur hanya bergantung pada tipe di file ini, tidak pada provider tertentu.
 */

export type JsonOutput = {
  /** Nama skema, huruf/angka/underscore. Contoh: "meme_captions". */
  name: string;
  /**
   * JSON Schema untuk jawaban AI. Tulis dalam bentuk "strict":
   * semua properti ada di `required` dan setiap object memakai `additionalProperties: false`.
   */
  schema: Record<string, unknown>;
};

export type GenerateTextInput = {
  /** Instruksi tetap untuk AI (gaya, aturan). */
  system: string;
  /** Permintaan untuk panggilan ini. */
  prompt: string;
  /** Kalau diisi, AI wajib menjawab JSON sesuai skema ini. Hasilnya tetap harus divalidasi. */
  json?: JsonOutput;
  /** Batas token jawaban. */
  maxOutputTokens?: number;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type GenerateTextResult = {
  /** Teks jawaban mentah. Untuk mode JSON, ini string JSON yang belum di-parse. */
  text: string;
  provider: string;
  model: string;
  usage: TokenUsage | null;
};

export interface TextProvider {
  name: string;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
}

export type GenerateImageInput = {
  /** Deskripsi gambar. Jangan pernah meminta model menulis teks. */
  prompt: string;
  /** Jumlah langkah pembuatan gambar. Kosong = pengaturan default provider. */
  steps?: number;
};

export type GenerateImageResult = {
  /** Isi file gambar. */
  data: Buffer;
  mimeType: "image/jpeg" | "image/png";
  provider: string;
  model: string;
};

export interface ImageProvider {
  name: string;
  generateImage(input: GenerateImageInput): Promise<GenerateImageResult>;
}

export type ModerationInput = {
  /** Teks yang diperiksa, misalnya nama koin, ticker, deskripsi, caption. */
  texts: string[];
  /** Gambar yang diperiksa. Harus URL yang bisa dibuka publik. */
  imageUrl?: string;
};

export type ModerationResult = {
  /** true = ada yang melanggar dan tidak boleh diterbitkan. */
  flagged: boolean;
  /** Kategori yang melanggar, misalnya ["sexual/minors"]. Untuk log, bukan untuk ditampilkan ke user. */
  categories: string[];
  provider: string;
  model: string;
};

export interface ModerationProvider {
  name: string;
  moderate(input: ModerationInput): Promise<ModerationResult>;
}

export type AiErrorCode =
  /** Provider menolak karena terlalu banyak request/token (HTTP 429). */
  | "rate_limited"
  /** Kuota gratis harian provider sudah habis (misalnya 10.000 neuron Cloudflare). */
  | "quota_exhausted"
  /** Provider tidak menjawab dalam batas waktu. */
  | "timeout"
  /** Provider sedang down atau tidak bisa dihubungi. */
  | "unavailable"
  /** Jawaban kosong, terpotong, atau tidak sesuai format. */
  | "bad_output"
  /** Salah pengaturan di server: API key kosong/salah, provider tidak dikenal. */
  | "config"
  /** Error lain dari provider (misalnya request ditolak). */
  | "provider_error";

/** Satu jenis error untuk semua provider, supaya kode fitur tidak perlu tahu format error Groq/OpenAI. */
export class AiError extends Error {
  readonly code: AiErrorCode;
  /** Berapa detik harus menunggu sebelum mencoba lagi (hanya untuk rate_limited, kalau provider memberi tahu). */
  readonly retryAfterSeconds?: number;

  constructor(
    code: AiErrorCode,
    message: string,
    options: { retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AiError";
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
