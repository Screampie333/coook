import { Wallet } from "lucide-react";

/**
 * Placeholder area wallet. Tombol Connect asli (Privy) dipasang di Step 2,
 * dan sisa kuota akan diambil dari server.
 */
export function WalletSlot() {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled
        title="Wallet login arrives in Step 2"
        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-bg opacity-60"
      >
        <Wallet className="size-4" />
        <span>Connect wallet</span>
      </button>

      <StatusDot state="idle" text="Quota: —" />
    </div>
  );
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
