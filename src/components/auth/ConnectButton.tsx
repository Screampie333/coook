"use client";

import { useLogin, useLogout, usePrivy } from "@privy-io/react-auth";
import { Loader2, LogOut, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { shortenAddress } from "@/lib/format";
import { getSolanaAddress, loginErrorMessage, usePhantomInstalled } from "./hooks";
import { usePrivyEnabled } from "./PrivyProviders";

type Variant = "full" | "compact";

/**
 * Tombol Connect / alamat wallet + Logout.
 * - "full": untuk kartu (lebar penuh, ada pesan bantuan di bawah).
 * - "compact": untuk top bar, di mobile maupun desktop.
 */
export function ConnectButton({ variant = "full" }: { variant?: Variant }) {
  const enabled = usePrivyEnabled();
  if (!enabled) {
    return (
      <div className={variant === "full" ? "flex flex-col gap-2" : ""}>
        <button type="button" disabled className={connectClass(variant, true)}>
          <Wallet className="size-4" />
          <span>Connect</span>
        </button>
        {variant === "full" && (
          <p className="px-1 text-xs text-warn">Login isn&apos;t configured (missing Privy App ID).</p>
        )}
      </div>
    );
  }
  return <PrivyConnectButton variant={variant} />;
}

function PrivyConnectButton({ variant }: { variant: Variant }) {
  const { ready, authenticated, user } = usePrivy();
  const phantomInstalled = usePhantomInstalled();
  const [error, setError] = useState<string | null>(null);

  const { login } = useLogin({
    onComplete: () => setError(null),
    onError: (code) => {
      // Kode asli dicatat di console supaya mudah dilacak saat testing.
      console.warn("[coook] Privy login error:", code);
      setError(loginErrorMessage(code));
    },
  });
  const { logout } = useLogout();

  // Pesan error hilang sendiri setelah 6 detik.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timer);
  }, [error]);

  const compact = variant === "compact";

  // 1. Privy belum siap
  if (!ready) {
    return (
      <button type="button" disabled aria-busy="true" className={connectClass(variant, true)}>
        <Loader2 className="size-4 animate-spin" />
        {!compact && <span>Loading…</span>}
      </button>
    );
  }

  // 2. Sudah login
  if (authenticated) {
    const address = getSolanaAddress(user);
    return (
      <div className="flex items-center gap-2">
        <span
          title={address ?? undefined}
          className={`flex min-w-0 items-center gap-2 rounded-[10px] border border-line bg-panel font-mono text-ink ${
            compact ? "h-9 px-2.5 text-xs" : "flex-1 px-3 py-2.25 text-[12.5px]"
          }`}
        >
          <span className="size-2 flex-none rounded-full bg-success" />
          <span className="truncate">{address ? shortenAddress(address) : "No Solana wallet"}</span>
        </span>
        <button
          type="button"
          onClick={() => logout()}
          aria-label="Logout"
          title="Logout"
          className={`inline-flex flex-none cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-line bg-panel text-muted transition-colors hover:border-line-hover hover:text-ink ${
            compact ? "size-9" : "px-3 py-2.25 text-[13px] font-medium"
          }`}
        >
          <LogOut className="size-4" />
          {!compact && <span>Logout</span>}
        </button>
      </div>
    );
  }

  // 3. Belum login
  const button = (
    <button
      type="button"
      onClick={() => {
        setError(null);
        login();
      }}
      className={connectClass(variant, false)}
    >
      <Wallet className="size-4" />
      <span>Connect</span>
    </button>
  );

  if (compact) {
    return (
      <div className="relative">
        {button}
        {error && (
          <p
            role="alert"
            className="absolute top-full right-0 z-50 mt-2 w-60 rounded-[10px] border border-warn/40 bg-panel px-3 py-2 text-xs text-warn shadow-lg"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {button}
      {error && (
        <p role="alert" className="px-1 text-xs text-warn">
          {error}
        </p>
      )}
      {!error && !phantomInstalled && (
        <p className="px-1 text-xs text-dim">
          Phantom not detected.{" "}
          <a
            href="https://phantom.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline-offset-2 hover:underline"
          >
            Install Phantom
          </a>{" "}
          or use Solflare / Backpack.
        </p>
      )}
    </div>
  );
}

function connectClass(variant: Variant, disabled: boolean) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full bg-accent font-bold text-bg transition-opacity";
  const size = variant === "compact" ? "h-9 px-3.5 text-[13px]" : "w-full px-4 py-2.5 text-sm";
  const state = disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:opacity-90";
  return `${base} ${size} ${state}`;
}
