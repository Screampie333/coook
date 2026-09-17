"use client";

import { Check, ChefHat, Copy } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { CAPTION_COUNT } from "@/lib/cook/limits";

type CaptionListProps = {
  captions: string[] | null;
  cooking: boolean;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  /** Kunci pilihan caption (misalnya saat meme sedang dimasak). Tombol copy tetap aktif. */
  selectionDisabled: boolean;
  /** Bagian bawah kartu, misalnya tombol "Cook meme". */
  footer?: React.ReactNode;
};

/** Kartu hasil: 3 caption bernomor yang bisa dipilih, masing-masing dengan tombol copy. */
export function CaptionList({
  captions,
  cooking,
  selectedIndex,
  onSelect,
  selectionDisabled,
  footer,
}: CaptionListProps) {
  const groupName = useId();

  return (
    <div aria-live="polite" aria-busy={cooking}>
      <Card icon={ChefHat} title="Fresh captions" right={cooking ? "Cooking…" : "Pick one for your meme"}>
        {cooking ? (
          Array.from({ length: CAPTION_COUNT }, (_, index) => <SkeletonRow key={index} index={index} />)
        ) : (
          <fieldset className="min-w-0">
            <legend className="sr-only">Pick a caption for your meme</legend>
            {captions?.map((caption, index) => (
              <CaptionRow
                key={`${index}-${caption}`}
                index={index}
                caption={caption}
                name={groupName}
                selected={selectedIndex === index}
                disabled={selectionDisabled}
                onSelect={() => onSelect(index)}
              />
            ))}
          </fieldset>
        )}
        {!cooking && captions && footer}
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

type CaptionRowProps = {
  index: number;
  caption: string;
  name: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
};

function CaptionRow({ index, caption, name, selected, disabled, onSelect }: CaptionRowProps) {
  return (
    <div
      className={`flex items-center gap-3 border-b border-line pr-4 transition-colors last:border-b-0 ${
        selected ? "bg-accent-soft" : "hover:bg-panel-2/60"
      }`}
    >
      <label
        className={`flex min-w-0 flex-1 items-center gap-3.5 py-3 pl-4 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input
          type="radio"
          name={name}
          value={index}
          checked={selected}
          disabled={disabled}
          onChange={onSelect}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`flex size-4.5 flex-none items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-panel ${
            selected ? "border-accent" : "border-line-hover"
          }`}
        >
          {selected && <span className="size-2 rounded-full bg-accent" />}
        </span>
        <RowNumber index={index} />
        <p className="min-w-0 flex-1 text-[15px] break-words text-ink">{caption}</p>
      </label>
      <CopyButton text={caption} />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState("idle"), 1400);
  }

  const label = { idle: "Copy caption", copied: "Copied!", failed: "Copy failed" }[copyState];

  return (
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
  );
}
