import "server-only";

import { getSupabase } from "@/lib/supabase/server";
import { throwDatabaseError } from "./errors";

/**
 * Membuat baris user kalau belum ada. Waktu daftar = created_at baris itu.
 * Dipanggil saat user login (ambil kuota) dan sebelum meme disimpan.
 */
export async function ensureUser(walletAddress: string, privyUserId: string) {
  const { error } = await getSupabase()
    .from("users")
    .upsert(
      { wallet_address: walletAddress, privy_user_id: privyUserId },
      // Jangan menimpa baris lama, supaya created_at tetap waktu daftar pertama.
      { onConflict: "wallet_address", ignoreDuplicates: true },
    );

  if (error) throwDatabaseError("could not save the user", error);
}
