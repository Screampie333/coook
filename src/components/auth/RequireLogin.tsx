"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Loader2, Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ConnectButton } from "./ConnectButton";
import { usePrivyEnabled } from "./PrivyProviders";

/**
 * Hanya menampilkan `children` kalau user sudah login.
 * Ini penjaga TAMPILAN saja. Data tetap dilindungi di API route (requireUser).
 */
export function RequireLogin({ children }: { children: React.ReactNode }) {
  const enabled = usePrivyEnabled();
  if (!enabled) return <ConnectCard />;
  return <PrivyGate>{children}</PrivyGate>;
}

function PrivyGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();

  if (!ready) {
    return (
      <Card icon={Lock} title="Your kitchen">
        <div className="flex items-center justify-center gap-2 px-4 py-12 text-[13px] text-dim">
          <Loader2 className="size-4 animate-spin" />
          <span>Checking your session…</span>
        </div>
      </Card>
    );
  }

  if (!authenticated) return <ConnectCard />;

  return <>{children}</>;
}

function ConnectCard() {
  return (
    <Card icon={Lock} title="Your kitchen" right="Locked">
      <div className="flex flex-col items-center px-4 py-10 text-center">
        <h3 className="text-lg font-bold">Connect your wallet to open your kitchen</h3>
        <p className="mt-2 max-w-[44ch] text-[13px] text-muted">
          Your memes are tied to your Solana wallet. Connect Phantom, Solflare, or Backpack to see them.
        </p>
        <div className="mt-5 w-full max-w-64">
          <ConnectButton />
        </div>
      </div>
    </Card>
  );
}
