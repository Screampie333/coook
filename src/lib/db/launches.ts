import "server-only";

import type { LaunchSummary } from "@/lib/cook/meme-types";
import { getSupabase } from "@/lib/supabase/server";
import { throwDatabaseError } from "./errors";

/**
 * Koin yang pernah di-mint dari meme.
 * Tabelnya sudah disiapkan; pengisiannya menyusul di Step 9 (fitur Serve).
 */

type LaunchRow = {
  id: string;
  mint_address: string;
  name: string;
  ticker: string;
  meme_id: string;
  created_at: string;
};

export async function listWalletLaunches(walletAddress: string, limit = 24): Promise<LaunchSummary[]> {
  const { data, error } = await getSupabase()
    .from("launches")
    .select("id, mint_address, name, ticker, meme_id, created_at")
    .eq("wallet_address", walletAddress)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throwDatabaseError("could not read your coins", error);

  return (data ?? []).map((row) => {
    const launch = row as unknown as LaunchRow;
    return {
      id: launch.id,
      mintAddress: launch.mint_address,
      name: launch.name,
      ticker: launch.ticker,
      memeId: launch.meme_id,
      createdAt: launch.created_at,
    };
  });
}
