import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Koneksi ke Supabase untuk SERVER saja.
 *
 * Memakai secret key (sb_secret_...) yang melewati Row Level Security, jadi:
 * - key ini tidak boleh pernah sampai ke browser (tanpa awalan NEXT_PUBLIC_)
 * - setiap query di server wajib memfilter sendiri milik siapa datanya
 */

let client: SupabaseClient | null = null;

export function isDatabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SECRET_KEY?.trim());
}

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) {
    throw new Error("SUPABASE_URL or SUPABASE_SECRET_KEY is missing.");
  }

  // Tidak ada sesi user Supabase: login user diurus Privy, server ini yang jadi penjaga pintu.
  client = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
