"use client";

import { Check, ChefHat, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { CAPTION_COUNT } from "@/lib/cook/limits";

type CaptionListProps = {
  captions: string[] | null;
  cooking: boolean;
};

/** Kartu hasil: 3 caption bernomor, masing-masing dengan tombol copy. */
export function CaptionList({ captions, cooking }: CaptionListProps) {
  return (
    <div aria-live="polite" aria-busy={cooking}>
      <Card icon={ChefHat} title="Fresh captions" right={cooking ? "Cooking…" : "Copy your favorite"}>
        {cooking
          ? Array.from({ length: CAPTION_COUNT }, (_, index) => <SkeletonRow key={index} index={index} />)
          : captions?.map((caption, index) => (
              <CaptionRow key={`${index}-${caption}`} index={index} caption={caption} />
            ))}
      </Card>
    </div>
  );
}

function RowNumber({ index }: { index: number }) {
  return (
    <span className="w-5 flex-none font-mono text-xs text-dim">{String(index + 1).padStart(2, "0")}</span>
  );
}

const SKELETON_WIDTHS = ["w-4/5", "w-3/5", "w-2/3"];

function SkeletonRow({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-3.5 border-b border-line px-4 py-4 last:border-b-0">
      <RowNumber index={index} />
      <span
        className={`h-3.5 animate-pulse rounded-full bg-panel-2 motion-reduce:animate-none ${SKELETON_WIDTHS[index % SKELETON_WIDTHS.length]}`}
      />
    </div>
  );
}

function CaptionRow({ index, caption }: { index: number; caption: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState("idle"), 1400);
  }

  const label = { idle: "Copy caption", copied: "Copied!", failed: "Copy failed" }[copyState];

  return (
    <div className="flex items-center gap-3.5 border-b border-line px-4 py-3 last:border-b-0">
      <RowNumber index={index} />
      <p className="min-w-0 flex-1 text-[15px] break-words text-ink">{caption}</p>
      <button
        type="button"
        onClick={copy}
        aria-label={label}
        title={label}
        className={`inline-flex size-8 flex-none cursor-pointer items-center justify-center rounded-lg border transition-colors ${
          copyState === "copied"
            ? "border-success/40 text-success"
            : copyState === "failed"
              ? "border-warn/40 text-warn"
              : "border-line text-muted hover:border-line-hover hover:text-ink"
        }`}
      >
        {copyState === "copied" ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
