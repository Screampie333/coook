import "server-only";

import { getSupabase } from "@/lib/supabase/server";
import { throwDatabaseError } from "./errors";

/**
 * Gambar meme disimpan di bucket "memes" (publik untuk dibaca).
 * Upload dan hapus hanya bisa dilakukan server ini, karena bucket tidak punya policy apa pun.
 */

const BUCKET = "memes";
const CACHE_SECONDS = 60 * 60 * 24 * 365;

/** Contoh: "WaLLet1111.../8f3c....jpg" */
export function memeImagePath(walletAddress: string, memeId: string, mimeType: string) {
  return `${walletAddress}/${memeId}.${mimeType === "image/png" ? "png" : "jpg"}`;
}

export async function uploadMemeImage(path: string, data: Buffer, contentType: string) {
  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, data, { contentType, cacheControl: String(CACHE_SECONDS), upsert: false });

  if (error) throwDatabaseError("could not upload the picture", error);
}

export function memeImageUrl(path: string) {
  return getSupabase().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Membersihkan file kalau baris meme gagal disimpan. Tidak pernah melempar error. */
export async function deleteMemeImage(path: string) {
  try {
    const { error } = await getSupabase().storage.from(BUCKET).remove([path]);
    if (error) console.error("[db] could not delete the picture:", error);
  } catch (error) {
    console.error("[db] could not delete the picture:", error);
  }
}
