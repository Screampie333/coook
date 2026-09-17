import "server-only";

import { z } from "zod";
import { getSupabase, isDatabaseConfigured } from "@/lib/supabase/server";
import type { LoreOption } from "./types";

/**
 * "Lore brain": identitas brand sebuah koin supaya meme-nya konsisten.
 * Disimpan di tabel "lores" (lihat supabase/migrations/0001_init.sql) dan diedit lewat Table Editor.
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

export type Lore = {
  id: string;
  name: string;
  /** Tanpa tanda $. */
  ticker: string;
  lore: string;
  mascot: {
    name: string;
    body: string;
    colors: string;
    outfit: string;
    face: string;
    details: string;
  };
  artStyle: string;
  humor: string;
  colors: { name: string; hex: string }[];
  words: { required: string[]; forbidden: string[] };
};

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

/** Bentuk satu baris tabel "lores". */
const loreRowSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,32}$/, "id must use lowercase letters, numbers and dashes"),
  name: z.string().trim().min(1).max(32),
  ticker: z.string().regex(/^[A-Z0-9]{1,10}$/, "ticker must be 1-10 uppercase letters or numbers, without $"),
  lore: z.string().trim().min(20, "lore is too short").max(600, "lore is longer than 600 characters"),
  mascot_name: visualText("mascot_name", 40),
  mascot_body: visualText("mascot_body", 200),
  mascot_colors: visualText("mascot_colors", 200),
  mascot_outfit: visualText("mascot_outfit", 200),
  mascot_face: visualText("mascot_face", 200),
  mascot_details: visualText("mascot_details", 200),
  art_style: visualText("art_style", 200),
  humor: z.string().trim().min(10, "humor is too short").max(300, "humor is longer than 300 characters"),
  colors: z
    .array(z.object({ name: visualText("colors[].name", 30), hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/) }))
    .min(1, "add at least one brand color")
    .max(6, "use at most 6 brand colors"),
  required_words: z.array(z.string().trim().min(1).max(40)).max(12),
  forbidden_words: z.array(z.string().trim().min(1).max(40)).max(30),
});

/**
 * Memeriksa satu baris lore. Baris yang tidak memenuhi aturan dicatat di log dan dilewati,
 * supaya satu lore yang salah tidak mematikan seluruh halaman.
 */
export function parseLoreRow(row: unknown): Lore | null {
  const parsed = loreRowSchema.safeParse(row);
  if (!parsed.success) {
    const id = (row as { id?: unknown })?.id;
    console.error(`[lore] row "${String(id)}" was skipped:\n${z.prettifyError(parsed.error)}`);
    return null;
  }

  const data = parsed.data;
  const lore: Lore = {
    id: data.id,
    name: data.name,
    ticker: data.ticker,
    lore: data.lore,
    mascot: {
      name: data.mascot_name,
      body: data.mascot_body,
      colors: data.mascot_colors,
      outfit: data.mascot_outfit,
      face: data.mascot_face,
      details: data.mascot_details,
    },
    artStyle: data.art_style,
    humor: data.humor,
    colors: data.colors,
    words: { required: data.required_words, forbidden: data.forbidden_words },
  };

  const mascotWords = countWords(mascotDescription(lore));
  if (mascotWords > MAX_MASCOT_WORDS) {
    console.error(`[lore] row "${lore.id}" was skipped: mascot description is ${mascotWords} words (max ${MAX_MASCOT_WORDS})`);
    return null;
  }
  const styleWords = countWords(lore.artStyle);
  if (styleWords > MAX_ART_STYLE_WORDS) {
    console.error(`[lore] row "${lore.id}" was skipped: art_style is ${styleWords} words (max ${MAX_ART_STYLE_WORDS})`);
    return null;
  }

  const forbidden = new Set(lore.words.forbidden.map((word) => word.toLowerCase()));
  const clash = lore.words.required.find((word) => forbidden.has(word.toLowerCase()));
  if (clash) {
    console.error(`[lore] row "${lore.id}" was skipped: "${clash}" is both required and forbidden`);
    return null;
  }

  return lore;
}

const SELECT_COLUMNS =
  "id, name, ticker, lore, mascot_name, mascot_body, mascot_colors, mascot_outfit, mascot_face, mascot_details, art_style, humor, colors, required_words, forbidden_words";

export async function getLore(id: string): Promise<Lore | null> {
  if (!isDatabaseConfigured()) return null;

  const { data, error } = await getSupabase()
    .from("lores")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[lore] could not read the lore:", error);
    return null;
  }
  return data ? parseLoreRow(data) : null;
}

/** Info ringkas untuk dropdown di browser. */
export async function listLoreOptions(): Promise<LoreOption[]> {
  // Tanpa database, halaman tetap jalan dengan pilihan "No lore" saja.
  if (!isDatabaseConfigured()) return [];

  const { data, error } = await getSupabase()
    .from("lores")
    .select(SELECT_COLUMNS)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[lore] could not read the lore list:", error);
    return [];
  }

  const options: LoreOption[] = [];
  for (const row of data ?? []) {
    const lore = parseLoreRow(row);
    if (lore) options.push({ id: lore.id, name: lore.name, ticker: lore.ticker, mascotName: lore.mascot.name });
  }
  return options;
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

/** Nama warna brand untuk prompt gambar (tanpa kode hex). */
export function paletteNames(lore: Pick<Lore, "colors">) {
  return lore.colors.map((color) => color.name).join(", ");
}

/** Buang spasi dan titik di akhir supaya kalimat yang disusun tidak dobel titik. */
function clean(text: string) {
  return text.trim().replace(/[.\s]+$/, "");
}
