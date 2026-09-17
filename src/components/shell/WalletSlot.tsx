"use client";

import { usePrivy } from "@privy-io/react-auth";
import { ConnectButton } from "@/components/auth/ConnectButton";
import { usePrivyEnabled } from "@/components/auth/PrivyProviders";

/** Grup Wallet di sidebar: tombol Connect + status kuota (kuota masih placeholder). */
export function WalletSlot() {
  const enabled = usePrivyEnabled();

  return (
    <div className="flex flex-col gap-3">
      <ConnectButton />
      {enabled ? <QuotaStatus /> : <StatusDot state="idle" text="Quota: —" />}
    </div>
  );
}

function QuotaStatus() {
  const { ready, authenticated } = usePrivy();
  // Angka kuota asli akan diambil dari server di step berikutnya.
  if (ready && authenticated) return <StatusDot state="success" text="Quota: —" />;
  return <StatusDot state="idle" text="Quota: —" />;
}

type StatusState = "idle" | "live" | "success";

/** Indikator status bertitik, seperti "Feed status" di referensi. */
export function StatusDot({ state, text }: { state: StatusState; text: string }) {
  const dot = {
    idle: "bg-dim",
    live: "bg-accent shadow-[0_0_0_3px_var(--color-accent-soft)]",
    success: "bg-success shadow-[0_0_0_3px_rgb(61_220_132/0.15)]",
  }[state];

  return (
    <div className="flex items-center gap-2 px-2 text-[13px] text-muted">
      <span className={`size-2 flex-none rounded-full ${dot}`} />
      <span className="font-mono">{text}</span>
    </div>
  );
}
