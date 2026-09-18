import "server-only";

import type { LaunchSummary } from "@/lib/cook/meme-types";
import type { Cluster } from "@/lib/launch/types";
import { getSupabase } from "@/lib/supabase/server";
import { throwDatabaseError } from "./errors";

/**
 * Koin yang dibuat dari meme.
 *
 * Alurnya dua langkah:
 * 1. prepare  → baris baru dengan status "pending" (transaksi sudah disiapkan, menunggu tanda tangan)
 * 2. confirm  → status jadi "confirmed" setelah koinnya benar-benar ada di blockchain
 *
 * Baris "pending" sengaja disimpan supaya saat confirm, server tahu nama/ticker/meme
 * dari catatannya sendiri, bukan dari kiriman browser yang bisa dipalsukan.
 */

type LaunchRow = {
  id: string;
  mint_address: string;
  name: string;
  ticker: string;
  meme_id: string;
  created_at: string;
  cluster?: string;
  status?: string;
};

function toSummary(row: LaunchRow): LaunchSummary {
  return {
    id: row.id,
    mintAddress: row.mint_address,
    name: row.name,
    ticker: row.ticker,
    memeId: row.meme_id,
    createdAt: row.created_at,
    cluster: (row.cluster as Cluster) ?? "mainnet",
  };
}

/** Koin milik satu wallet yang sudah benar-benar jadi (/kitchen). */
export async function listWalletLaunches(walletAddress: string, limit = 24): Promise<LaunchSummary[]> {
  const { data, error } = await getSupabase()
    .from("launches")
    .select("id, mint_address, name, ticker, meme_id, created_at, cluster")
    .eq("wallet_address", walletAddress)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throwDatabaseError("could not read your coins", error);
  return (data ?? []).map((row) => toSummary(row as unknown as LaunchRow));
}

/** true kalau meme ini sudah pernah jadi koin. Satu meme hanya boleh jadi satu koin. */
export async function hasConfirmedLaunch(memeId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("launches")
    .select("id")
    .eq("meme_id", memeId)
    .eq("status", "confirmed")
    .maybeSingle();

  if (error) throwDatabaseError("could not check the coin", error);
  return data !== null;
}

export type PendingLaunch = {
  id: string;
  mintAddress: string;
  memeId: string;
  name: string;
  ticker: string;
  cluster: Cluster;
};

/** Mencatat percobaan pembuatan koin sebelum transaksinya dikirim ke user. */
export async function insertPendingLaunch(launch: {
  mintAddress: string;
  memeId: string;
  walletAddress: string;
  name: string;
  ticker: string;
  description: string;
  caption: string | null;
  metadataUri: string;
  imageCid: string;
  cluster: Cluster;
}): Promise<PendingLaunch> {
  // Percobaan lama untuk meme yang sama sudah tidak berlaku (blockhash-nya cuma hidup ~1 menit).
  const { error: cleanupError } = await getSupabase()
    .from("launches")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("meme_id", launch.memeId)
    .eq("wallet_address", launch.walletAddress)
    .eq("status", "pending");

  if (cleanupError) throwDatabaseError("could not tidy up older attempts", cleanupError);

  const { data, error } = await getSupabase()
    .from("launches")
    .insert({
      mint_address: launch.mintAddress,
      meme_id: launch.memeId,
      wallet_address: launch.walletAddress,
      name: launch.name,
      ticker: launch.ticker,
      description: launch.description,
      caption: launch.caption,
      metadata_uri: launch.metadataUri,
      image_cid: launch.imageCid,
      cluster: launch.cluster,
      status: "pending",
    })
    .select("id, mint_address, meme_id, name, ticker, cluster")
    .single();

  if (error) throwDatabaseError("could not save the coin attempt", error);

  const row = data as unknown as LaunchRow;
  return {
    id: row.id,
    mintAddress: row.mint_address,
    memeId: row.meme_id,
    name: row.name,
    ticker: row.ticker,
    cluster: (row.cluster as Cluster) ?? "mainnet",
  };
}

/**
 * Mencari percobaan yang masih menunggu tanda tangan.
 * Filter wallet_address memastikan user hanya bisa melanjutkan percobaannya sendiri.
 */
export async function findPendingLaunch(mintAddress: string, walletAddress: string): Promise<PendingLaunch | null> {
  const { data, error } = await getSupabase()
    .from("launches")
    .select("id, mint_address, meme_id, name, ticker, cluster")
    .eq("mint_address", mintAddress)
    .eq("wallet_address", walletAddress)
    .eq("status", "pending")
    .maybeSingle();

  if (error) throwDatabaseError("could not find the coin attempt", error);
  if (!data) return null;

  const row = data as unknown as LaunchRow;
  return {
    id: row.id,
    mintAddress: row.mint_address,
    memeId: row.meme_id,
    name: row.name,
    ticker: row.ticker,
    cluster: (row.cluster as Cluster) ?? "mainnet",
  };
}

/** Koinnya sudah benar-benar ada di blockchain. */
export async function markLaunchConfirmed(launchId: string, signature: string): Promise<void> {
  const { error } = await getSupabase()
    .from("launches")
    .update({ status: "confirmed", signature, updated_at: new Date().toISOString() })
    .eq("id", launchId);

  if (error) throwDatabaseError("could not save the finished coin", error);
}

/** Percobaan gagal atau dibatalkan. Tidak pernah melempar error supaya tidak menutupi error aslinya. */
export async function markLaunchFailed(launchId: string): Promise<void> {
  try {
    const { error } = await getSupabase()
      .from("launches")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", launchId);

    if (error) console.error("[db] could not mark the coin attempt as failed:", error);
  } catch (error) {
    console.error("[db] could not mark the coin attempt as failed:", error);
  }
}
