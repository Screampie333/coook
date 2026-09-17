"use client";

import { Check, Copy, Download, ImageIcon, Loader2, RefreshCw, Rocket } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { CAPTION_COUNT } from "@/lib/cook/limits";

export type Meme = {
  caption: string;
  /** data URL JPEG yang sudah ada caption-nya. */
  image: string;
};

type MemeCardProps = {
  cooking: boolean;
  memes: Meme[] | null;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onCookAgain: () => void;
  cookAgainDisabled: boolean;
  /** Info kecil di bawah tombol, misalnya sisa jatah. */
  hint?: string;
  /** Awalan nama file download, misalnya "coook-meme-2026-09-17-143005". */
  fileStem: string;
};

const buttonBase =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const primaryButton = `${buttonBase} bg-accent text-bg hover:opacity-90`;
const secondaryButton = `${buttonBase} border border-line bg-panel text-ink hover:border-line-hover disabled:hover:border-line`;

/**
 * Kartu hasil Cook: 1 gambar + 3 caption.
 * Server sudah menempel tiap caption ke gambar, jadi ganti caption = ganti gambar yang ditampilkan.
 */
export function MemeCard({
  cooking,
  memes,
  selectedIndex,
  onSelect,
  onCookAgain,
  cookAgainDisabled,
  hint,
  fileStem,
}: MemeCardProps) {
  const groupName = useId();
  const [showServeNote, setShowServeNote] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const selected = memes?.[selectedIndex] ?? null;

  async function download() {
    if (!selected) return;
    setDownloadFailed(false);
    try {
      const blob = await (await fetch(selected.image)).blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileStem}-${selectedIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setDownloadFailed(true);
    }
  }

  return (
    <div aria-live="polite" aria-busy={cooking}>
      <Card icon={ImageIcon} title="Your meme" right={cooking ? "Cooking…" : "Pick your caption"}>
        <div className="@container">
          <div className="grid gap-5 p-4 @2xl:grid-cols-2">
            {/* Gambar */}
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-line bg-panel-2">
              {cooking && (
                <>
                  <div className="absolute inset-0 animate-pulse bg-panel-2 motion-reduce:animate-none" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <Loader2 className="size-6 animate-spin text-accent" />
                    <p className="text-sm font-bold text-ink">Cooking your meme…</p>
                    <p className="max-w-[30ch] text-xs text-dim">
                      Drawing the picture first, then writing captions for it. About 5 seconds.
                    </p>
                  </div>
                </>
              )}
              {!cooking && selected && (
                <Image
                  src={selected.image}
                  alt={`Meme with the caption: ${selected.caption}`}
                  width={1024}
                  height={1024}
                  unoptimized
                  className="size-full object-cover"
                />
              )}
            </div>

            {/* Caption + tombol */}
            <div className="flex min-w-0 flex-col gap-4">
              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className="sr-only">Pick a caption for your meme</legend>
                <p className="text-[10px] font-bold tracking-[0.12em] text-dim uppercase">
                  {cooking ? "Writing captions" : "Captions"}
                </p>
                {cooking
                  ? Array.from({ length: CAPTION_COUNT }, (_, index) => <SkeletonRow key={index} index={index} />)
                  : memes?.map((meme, index) => (
                      <CaptionRow
                        key={`${index}-${meme.caption}`}
                        caption={meme.caption}
                        name={groupName}
                        selected={index === selectedIndex}
                        onSelect={() => onSelect(index)}
                      />
                    ))}
              </fieldset>

              {!cooking && selected && (
                <div className="flex flex-col gap-2.5">
                  <button type="button" onClick={download} className={`${primaryButton} w-full`}>
                    <Download className="size-4" />
                    <span>Download</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={onCookAgain}
                      disabled={cookAgainDisabled}
                      className={secondaryButton}
                    >
                      <RefreshCw className="size-4" />
                      <span>Cook again</span>
                    </button>
                    <button type="button" onClick={() => setShowServeNote(true)} className={secondaryButton}>
                      <Rocket className="size-4" />
                      <span>Serve as coin</span>
                    </button>
                  </div>

                  {hint && <p className="text-center font-mono text-xs text-dim">{hint}</p>}
                  {downloadFailed && (
                    <p role="alert" className="text-center text-[13px] text-warn">
                      Download failed. Right-click the image and save it instead.
                    </p>
                  )}
                  {showServeNote && (
                    <p role="status" className="text-center text-[13px] text-muted">
                      Serving memes as pump.fun coins is coming soon.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

const SKELETON_WIDTHS = ["w-4/5", "w-3/5", "w-2/3"];

function SkeletonRow({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-line px-3 py-3.5">
      <span className="size-4.5 flex-none rounded-full border-2 border-line" />
      <span
        className={`h-3.5 animate-pulse rounded-full bg-panel-2 motion-reduce:animate-none ${SKELETON_WIDTHS[index % SKELETON_WIDTHS.length]}`}
      />
    </div>
  );
}

type CaptionRowProps = {
  caption: string;
  name: string;
  selected: boolean;
  onSelect: () => void;
};

function CaptionRow({ caption, name, selected, onSelect }: CaptionRowProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-[10px] border pr-2 transition-colors ${
        selected ? "border-accent bg-accent-soft" : "border-line hover:border-line-hover"
      }`}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pl-3">
        <input
          type="radio"
          name={name}
          checked={selected}
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
        <span className="min-w-0 flex-1 text-sm leading-snug break-words text-ink">{caption}</span>
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
