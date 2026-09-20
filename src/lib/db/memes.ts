import "server-only";

import type { MemeSummary } from "@/lib/cook/meme-types";
import { getSupabase } from "@/lib/supabase/server";
import { throwDatabaseError } from "./errors";
import { memeImageUrl } from "./storage";

/** Jumlah meme per halaman galeri. */
export const MEMES_PAGE_SIZE = 24;

/**
 * Memeriksa penanda halaman ("muat yang lebih lama") sebelum masuk ke database.
 *
 * Nilainya datang mentah dari URL. Tanpa pemeriksaan ini, teks sembarang bikin
 * Postgres menolak query-nya, user dapat error 503 yang membingungkan, dan
 * seluruh isi kiriman ikut tertulis ke log server.
 *
 * @returns waktu ISO yang sudah dirapikan, atau null kalau tidak dikirim/tidak valid.
 */
export function parseCursor(value: string | null | undefined): string | null {
  // Waktu ISO paling panjang sekitar 30 karakter; sisanya pasti bukan waktu.
  if (typeof value !== "string" || value.length === 0 || value.length > 40) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

const SELECT_COLUMNS = "id, wallet_address, idea, image_path, captions, caption_index, created_at";

type MemeRow = {
  id: string;
  wallet_address: string;
  idea: string;
  image_path: string;
  captions: string[] | null;
  caption_index: number | null;
  created_at: string;
};

function toSummary(row: MemeRow, options: { withIdea: boolean }): MemeSummary {
  return {
    id: row.id,
    imageUrl: memeImageUrl(row.image_path),
    captions: row.captions ?? [],
    captionIndex: row.caption_index,
    // Ide user hanya ditampilkan ke pemiliknya sendiri.
    idea: options.withIdea ? row.idea : null,
    walletAddress: row.wallet_address,
    createdAt: row.created_at,
  };
}

export async function insertMeme(meme: {
  id: string;
  walletAddress: string;
  idea: string;
  imagePath: string;
  captions: string[];
}) {
  const { error } = await getSupabase().from("memes").insert({
    id: meme.id,
    wallet_address: meme.walletAddress,
    idea: meme.idea,
    image_path: meme.imagePath,
    captions: meme.captions,
  });

  if (error) throwDatabaseError("could not save the meme", error);
}

/** Galeri publik (/menu). */
export async function listRecentMemes(options: {
  before?: string;
  limit?: number;
}): Promise<MemeSummary[]> {
  const limit = options.limit ?? MEMES_PAGE_SIZE;
  let query = getSupabase()
    .from("memes")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.before) query = query.lt("created_at", options.before);

  const { data, error } = await query;
  if (error) throwDatabaseError("could not read the meme gallery", error);
  return (data ?? []).map((row) => toSummary(row as unknown as MemeRow, { withIdea: false }));
}

/** Meme milik satu wallet (/kitchen). */
export async function listWalletMemes(
  walletAddress: string,
  options: { before?: string; limit?: number } = {},
): Promise<MemeSummary[]> {
  const limit = options.limit ?? MEMES_PAGE_SIZE;
  let query = getSupabase()
    .from("memes")
    .select(SELECT_COLUMNS)
    .eq("wallet_address", walletAddress)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.before) query = query.lt("created_at", options.before);

  const { data, error } = await query;
  if (error) throwDatabaseError("could not read your memes", error);
  return (data ?? []).map((row) => toSummary(row as unknown as MemeRow, { withIdea: true }));
}

export type MemeForLaunch = {
  id: string;
  imagePath: string;
  captions: string[];
  idea: string;
};

/**
 * Meme milik satu user, untuk dijadikan koin.
 * Filter wallet_address memastikan user tidak bisa menjadikan meme orang lain sebagai koinnya.
 */
export async function getMemeForOwner(memeId: string, walletAddress: string): Promise<MemeForLaunch | null> {
  const { data, error } = await getSupabase()
    .from("memes")
    .select("id, image_path, captions, idea")
    .eq("id", memeId)
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (error) throwDatabaseError("could not read that meme", error);
  if (!data) return null;

  const row = data as unknown as Pick<MemeRow, "id" | "image_path" | "captions" | "idea">;
  return {
    id: row.id,
    imagePath: row.image_path,
    captions: row.captions ?? [],
    idea: row.idea,
  };
}

/**
 * Mencatat caption yang dipilih pembuatnya (dipanggil saat Download).
 * Filter wallet_address memastikan user hanya bisa mengubah meme miliknya sendiri.
 * @returns false kalau meme tidak ada atau bukan milik wallet itu.
 */
export async function setCaptionIndex(memeId: string, walletAddress: string, captionIndex: number | null) {
  const { data, error } = await getSupabase()
    .from("memes")
    .update({ caption_index: captionIndex })
    .eq("id", memeId)
    .eq("wallet_address", walletAddress)
    .select("id")
    .maybeSingle();

  if (error) throwDatabaseError("could not save the caption choice", error);
  return data !== null;
}
