import "server-only";

import { z } from "zod";
import rawConfig from "@/config/lores.json";
import type { LoreOption } from "./types";

/**
 * "Lore brain": identitas brand sebuah koin supaya meme-nya konsisten.
 * Sementara disimpan di src/config/lores.json (nanti dipindah ke database).
 *
 * FLUX schnell tidak bisa diberi gambar referensi, jadi konsistensi maskot dijaga dengan
 * deskripsi visual yang SAMA PERSIS di setiap prompt gambar (lihat mascotDescription).
 */

/**
 * FLUX schnell hanya membaca 256 token prompt (±190 kata). Deskripsi maskot + gaya gambar
 * dibatasi supaya masih ada ruang untuk adegan (lihat buildImagePrompt di src/lib/cook/scene.ts).
 */
export const MAX_MASCOT_WORDS = 80;
export const MAX_ART_STYLE_WORDS = 25;

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Teks yang masuk ke prompt gambar tidak boleh memuat #, $ atau tanda kutip: model gambar suka menuliskannya. */
const visualText = (field: string, max: number) =>
  z
    .string()
    .trim()
    .min(3, `${field} is too short`)
    .max(max, `${field} is longer than ${max} characters`)
    .refine((value) => !/[#$"“”]/.test(value), {
      message: `${field} must not contain #, $ or quotes (the image model may draw them as text)`,
    });

const wordList = (field: string, maxItems: number) =>
  z
    .array(z.string().trim().min(1, `${field} has an empty word`).max(40, `${field} has a word over 40 characters`))
    .max(maxItems, `${field} can have at most ${maxItems} words`);

const loreSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,32}$/, "id must use lowercase letters, numbers and dashes"),
  name: z.string().trim().min(1).max(32),
  ticker: z.string().regex(/^[A-Z0-9]{1,10}$/, "ticker must be 1-10 uppercase letters or numbers, without $"),
  lore: z.string().trim().min(20, "lore is too short").max(600, "lore is longer than 600 characters"),
  mascot: z.object({
    name: visualText("mascot.name", 40),
    body: visualText("mascot.body", 200),
    colors: visualText("mascot.colors", 200),
    outfit: visualText("mascot.outfit", 200),
    face: visualText("mascot.face", 200),
    details: visualText("mascot.details", 200),
  }),
  artStyle: visualText("artStyle", 200),
  humor: z.string().trim().min(10, "humor is too short").max(300, "humor is longer than 300 characters"),
  colors: z
    .array(
      z.object({
        name: visualText("colors[].name", 30),
        hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "colors[].hex must look like #FF6B1A"),
      }),
    )
    .min(1, "add at least one brand color")
    .max(6, "use at most 6 brand colors"),
  words: z.object({
    required: wordList("words.required", 12),
    forbidden: wordList("words.forbidden", 30),
  }),
});

export type Lore = z.infer<typeof loreSchema>;

const configSchema = z
  .object({ lores: z.array(loreSchema) })
  .superRefine((config, ctx) => {
    const seen = new Set<string>();
    config.lores.forEach((lore, index) => {
      const at = (path: (string | number)[], message: string) =>
        ctx.addIssue({ code: "custom", path: ["lores", index, ...path], message });

      if (seen.has(lore.id)) at(["id"], `duplicate lore id "${lore.id}"`);
      seen.add(lore.id);

      const mascotWords = countWords(mascotDescription(lore));
      if (mascotWords > MAX_MASCOT_WORDS) {
        at(["mascot"], `mascot description is ${mascotWords} words; keep it under ${MAX_MASCOT_WORDS}`);
      }
      const styleWords = countWords(lore.artStyle);
      if (styleWords > MAX_ART_STYLE_WORDS) {
        at(["artStyle"], `artStyle is ${styleWords} words; keep it under ${MAX_ART_STYLE_WORDS}`);
      }

      const forbidden = new Set(lore.words.forbidden.map((word) => word.toLowerCase()));
      for (const word of lore.words.required) {
        if (forbidden.has(word.toLowerCase())) at(["words"], `"${word}" is both required and forbidden`);
      }
    });
  });

/** Memeriksa isi file lore. Dipakai saat file dibaca, dan bisa dipakai untuk tes. */
export function parseLoreConfig(value: unknown): Lore[] {
  const parsed = configSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`src/config/lores.json is invalid:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data.lores;
}

/**
 * Deskripsi visual maskot. Disusun dari field lore dengan urutan tetap,
 * jadi teksnya persis sama di setiap prompt gambar.
 */
export function mascotDescription(lore: Pick<Lore, "mascot">) {
  const m = lore.mascot;
  return (
    `The main character is ${clean(m.name)}: ${clean(m.body)}. ` +
    `Colors: ${clean(m.colors)}. Outfit: ${clean(m.outfit)}. Face: ${clean(m.face)}. Details: ${clean(m.details)}.`
  );
}

/** Gaya gambar dengan satu titik di akhir. */
export function artStyleSentence(lore: Pick<Lore, "artStyle">) {
  return `${clean(lore.artStyle)}.`;
}

/** Buang spasi dan titik di akhir supaya kalimat yang disusun tidak dobel titik. */
function clean(text: string) {
  return text.trim().replace(/[.\s]+$/, "");
}

/** Nama warna brand untuk prompt gambar (tanpa kode hex). */
export function paletteNames(lore: Pick<Lore, "colors">) {
  return lore.colors.map((color) => color.name).join(", ");
}

// Dibaca dan dicek sekali saat server mulai. File yang salah langsung memunculkan error yang jelas.
const LORES = parseLoreConfig(rawConfig);

export function getLore(id: string): Lore | null {
  return LORES.find((lore) => lore.id === id) ?? null;
}

/** Info ringkas untuk dropdown di browser. */
export function listLoreOptions(): LoreOption[] {
  return LORES.map((lore) => ({
    id: lore.id,
    name: lore.name,
    ticker: lore.ticker,
    mascotName: lore.mascot.name,
  }));
}
