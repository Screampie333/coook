"use client";

import { useSyncExternalStore } from "react";
import { authFetch } from "@/components/auth/hooks";
import { isImageQuota, type ImageQuota } from "@/lib/cook/limits";

/**
 * Sisa jatah meme hari ini, dipakai bersama oleh sidebar dan form Cook.
 * Diisi dari GET /api/cook/quota dan diperbarui dari setiap respons POST /api/cook.
 */

let current: ImageQuota | null = null;
const listeners = new Set<() => void>();

export function setImageQuota(quota: ImageQuota | null) {
  current = quota;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** null = belum diketahui (belum login atau belum dimuat). */
export function useImageQuota() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

export async function refreshImageQuota() {
  try {
    const response = await authFetch("/api/cook/quota");
    if (!response.ok) return;
    const body: unknown = await response.json();
    if (isImageQuota(body)) setImageQuota(body);
  } catch {
    // Gagal memuat kuota tidak menghentikan apa pun; tampilan tetap "—".
  }
}
