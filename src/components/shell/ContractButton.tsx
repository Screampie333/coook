"use client";

import { Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shortenAddress } from "@/lib/format";

// Alamat contract diisi lewat .env.local. Kosong = belum launch.
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";

/** Tombol untuk menyalin contract address koin Coook. */
export function ContractButton() {
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function showFlash(text: string, ok: boolean) {
    clearTimeout(timer.current);
    setFlash({ text, ok });
    timer.current = setTimeout(() => setFlash(null), 1400);
  }

  async function handleClick() {
    if (!CONTRACT_ADDRESS) {
      showFlash("Not live yet", false);
      return;
    }
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      showFlash("Copied!", true);
    } catch {
      showFlash("Copy failed", false);
    }
  }

  const label = flash?.text ?? (CONTRACT_ADDRESS ? shortenAddress(CONTRACT_ADDRESS) : "Coming soon");

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Click to copy contract address"
      aria-label="Copy contract address"
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border border-line bg-panel px-3 py-2.25 text-left text-ink hover:border-line-hover"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[10px] tracking-[0.09em] text-dim uppercase">Address</span>
        <span
          aria-live="polite"
          className={`truncate font-mono text-[12.5px] ${flash?.ok ? "text-accent" : ""}`}
        >
          {label}
        </span>
      </span>
      <Copy className="size-3.75 flex-none text-dim" />
    </button>
  );
}
