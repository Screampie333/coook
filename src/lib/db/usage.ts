import "server-only";

import { IMAGE_DAILY_LIMIT, nextUtcMidnight, utcDay, type ImageQuota } from "@/lib/cook/limits";
import { getSupabase } from "@/lib/supabase/server";
import { throwDatabaseError } from "./errors";

/**
 * Jatah gambar harian per wallet, disimpan di tabel "usage" (hari dihitung UTC).
 * Pemotongan jatah memakai fungsi database supaya dua klik bersamaan tidak bisa menembus batas.
 */

/** Tanda bukti jatah yang sudah dipotong, dipakai untuk mengembalikan jatah kalau gagal. */
export type ImageReservation = { wallet: string; day: string };

function toQuota(used: number, now = new Date()): ImageQuota {
  return {
    used,
    limit: IMAGE_DAILY_LIMIT,
    remaining: Math.max(0, IMAGE_DAILY_LIMIT - used),
    resetsAt: nextUtcMidnight(now).toISOString(),
  };
}

export async function getImageQuota(walletAddress: string): Promise<ImageQuota> {
  const { data, error } = await getSupabase()
    .from("usage")
    .select("images_used")
    .eq("wallet_address", walletAddress)
    .eq("day", utcDay())
    .maybeSingle();

  if (error) throwDatabaseError("could not read the daily quota", error);
  return toQuota(typeof data?.images_used === "number" ? data.images_used : 0);
}

/** Memotong 1 jatah SEBELUM gambar dibuat. Kalau gagal, panggil refundImage(). */
export async function reserveImage(
  walletAddress: string,
): Promise<{ ok: true; reservation: ImageReservation; quota: ImageQuota } | { ok: false; quota: ImageQuota }> {
  const { data, error } = await getSupabase().rpc("reserve_image", {
    p_wallet: walletAddress,
    p_limit: IMAGE_DAILY_LIMIT,
  });

  if (error) throwDatabaseError("could not reserve the daily quota", error);

  // null = jatah hari ini sudah habis.
  if (typeof data !== "number") return { ok: false, quota: toQuota(IMAGE_DAILY_LIMIT) };
  return { ok: true, reservation: { wallet: walletAddress, day: utcDay() }, quota: toQuota(data) };
}

/**
 * Mengembalikan jatah yang dipotong reserveImage().
 * Tidak pernah melempar error, supaya tidak menutupi error aslinya. null = jumlahnya tidak diketahui.
 */
export async function refundImage(reservation: ImageReservation): Promise<ImageQuota | null> {
  try {
    const { data, error } = await getSupabase().rpc("refund_image", {
      p_wallet: reservation.wallet,
      p_day: reservation.day,
    });
    if (error) {
      console.error("[db] could not refund the daily quota:", error);
      return null;
    }
    return typeof data === "number" ? toQuota(data) : null;
  } catch (error) {
    console.error("[db] could not refund the daily quota:", error);
    return null;
  }
}
