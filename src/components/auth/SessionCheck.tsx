"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { shortenAddress } from "@/lib/format";
import { authFetch } from "./hooks";

type CheckState =
  | { status: "loading" }
  | { status: "ok"; walletAddress: string }
  | { status: "error"; code: number; message: string };

async function fetchMe(): Promise<CheckState> {
  try {
    const res = await authFetch("/api/me");
    const body = await res.json();
    if (res.ok) return { status: "ok", walletAddress: body.walletAddress };
    return { status: "error", code: res.status, message: body.error ?? "Request failed" };
  } catch {
    return { status: "error", code: 0, message: "Network error" };
  }
}

/**
 * Kartu testing: memanggil /api/me dan menampilkan alamat wallet
 * yang dikenali SERVER dari access token Privy.
 */
export function SessionCheck() {
  const [state, setState] = useState<CheckState>({ status: "loading" });
  // Dinaikkan setiap kali tombol "Check again" ditekan, supaya effect jalan lagi.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <Card
      icon={ShieldCheck}
      title="Session check"
      right={<span className="font-mono">GET /api/me</span>}
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-4 text-[13px]">
        {state.status === "loading" && <span className="text-dim">Asking the server…</span>}

        {state.status === "ok" && (
          <span className="flex items-center gap-2 text-muted">
            <span className="size-2 rounded-full bg-success" />
            Server verified wallet
            <span className="font-mono text-ink" title={state.walletAddress}>
              {shortenAddress(state.walletAddress)}
            </span>
          </span>
        )}

        {state.status === "error" && (
          <span className="flex items-center gap-2 text-warn">
            <span className="size-2 rounded-full bg-warn" />
            <span className="font-mono">{state.code || "—"}</span>
            {state.message}
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          }}
          className="ml-auto cursor-pointer rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-line-hover hover:text-ink"
        >
          Check again
        </button>
      </div>
    </Card>
  );
}
