"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";
import { usePrivyEnabled } from "@/components/auth/PrivyProviders";
import { refreshImageQuota, setImageQuota, useImageQuota } from "@/components/cook/quota-store";

/**
 * Grup Wallet di sidebar: sisa jatah meme hari ini.
 * Tombol Connect-nya ada di bar atas (TopBar), di mobile maupun desktop.
 */
export function WalletSlot() {
  const enabled = usePrivyEnabled();

  return enabled ? <QuotaStatus /> : <StatusDot state="idle" text="Memes left: —" />;
}

function QuotaStatus() {
  const { ready, authenticated, user } = usePrivy();
  const quota = useImageQuota();
  const userId = user?.id;

  // Muat kuota saat login (atau ganti akun), kosongkan saat logout.
  useEffect(() => {
    if (!ready) return;
    if (authenticated) void refreshImageQuota();
    else setImageQuota(null);
  }, [ready, authenticated, userId]);

  if (!ready || !authenticated || !quota) return <StatusDot state="idle" text="Memes left: —" />;
  return (
    <StatusDot
      state={quota.remaining > 0 ? "success" : "warn"}
      text={`Memes left: ${quota.remaining}/${quota.limit}`}
    />
  );
}

type StatusState = "idle" | "live" | "success" | "warn";

/** Indikator status bertitik, seperti "Feed status" di referensi. */
export function StatusDot({ state, text }: { state: StatusState; text: string }) {
  const dot = {
    idle: "bg-dim",
    live: "bg-accent shadow-[0_0_0_3px_var(--color-accent-soft)]",
    success: "bg-success shadow-[0_0_0_3px_rgb(61_220_132/0.15)]",
    warn: "bg-warn shadow-[0_0_0_3px_rgb(255_92_114/0.15)]",
  }[state];

  return (
    <div className="flex items-center gap-2 px-2 text-[13px] text-muted">
      <span className={`size-2 flex-none rounded-full ${dot}`} />
      <span className="font-mono">{text}</span>
    </div>
  );
}
