"use client";

import { ArrowLeft, Check, Copy, Download, ImageIcon, Loader2, PenLine, RefreshCw, Rocket } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { hasDrawableText } from "@/lib/cook/caption-layout";
import { CAPTION_COUNT, CUSTOM_CAPTION_MAX_LENGTH } from "@/lib/cook/limits";
import { recordCaptionChoice } from "./caption-choice";
import { renderMeme } from "./render-meme";
import { ServeDialog } from "./ServeDialog";

export type CookedResult = {
  /** id baris meme di database. */
  memeId: string;
  /** URL gambar tanpa caption di Supabase Storage. */
  picture: string;
  /** 3 caption dari AI. */
  captions: string[];
};

/** Caption yang dipakai: tidak ada, salah satu caption AI, atau tulisan user sendiri. */
export type CaptionChoice = { kind: "none" } | { kind: "ai"; index: number } | { kind: "custom" };

type MemeCardProps = {
  cooking: boolean;
  result: CookedResult | null;
  choice: CaptionChoice;
  onChoose: (choice: CaptionChoice) => void;
  customCaption: string;
  onCustomCaptionChange: (text: string) => void;
  /** Kosong = tombol "Cook again" disembunyikan (dipakai saat mengedit meme lama di Kitchen). */
  onCookAgain?: () => void;
  cookAgainDisabled?: boolean;
  /** Kalau diisi, muncul tombol panah "Back" di pojok kiri atas gambar. */
  onClose?: () => void;
  /** Info kecil di bawah tombol, misalnya sisa jatah. */
  hint?: string;
  /** Awalan nama file download, misalnya "coook-meme-2026-09-17-143005". */
  fileStem: string;
  /** Nama lore yang dipakai untuk hasil ini, atau null untuk meme bebas. */
  loreName: string | null;
};

/** Jeda setelah berhenti mengetik sebelum preview digambar ulang. */
const CUSTOM_RENDER_DELAY_MS = 150;

const buttonBase =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const primaryButton = `${buttonBase} bg-accent text-bg hover:opacity-90`;
const secondaryButton = `${buttonBase} border border-line bg-panel text-ink hover:border-line-hover disabled:hover:border-line`;

/** Kartu hasil Cook: 1 gambar + caption opsional (dari AI atau tulisan sendiri). */
export function MemeCard({
  cooking,
  result,
  choice,
  onChoose,
  customCaption,
  onCustomCaptionChange,
  onCookAgain,
  cookAgainDisabled,
  onClose,
  hint,
  fileStem,
  loreName,
}: MemeCardProps) {
  const groupName = useId();
  const [serving, setServing] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const [rendered, setRendered] = useState<{ picture: string; caption: string; image: string } | null>(null);
  const [renderFailed, setRenderFailed] = useState(false);

  const captionText =
    choice.kind === "ai" ? (result?.captions[choice.index] ?? "") : choice.kind === "custom" ? customCaption : "";
  const withCaption = hasDrawableText(captionText);

  // Gambar ulang preview setiap kali caption atau gambar berubah.
  useEffect(() => {
    if (!result || !withCaption) return;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        setRenderFailed(false);
        renderMeme(result.picture, captionText).then(
          (image) => {
            if (!cancelled) setRendered({ picture: result.picture, caption: captionText, image });
          },
          () => {
            if (!cancelled) setRenderFailed(true);
          },
        );
      },
      choice.kind === "custom" ? CUSTOM_RENDER_DELAY_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [result, captionText, withCaption, choice.kind]);

  const renderedForPicture = rendered && result && rendered.picture === result.picture ? rendered : null;
  const upToDate = !withCaption || renderedForPicture?.caption === captionText;
  const shownImage = !result ? null : withCaption ? (renderedForPicture?.image ?? result.picture) : result.picture;
  const updating = withCaption && !upToDate && !renderFailed;
  const canDownload = shownImage !== null && upToDate && !renderFailed;

  async function download() {
    if (!canDownload || !shownImage) return;
    setDownloadFailed(false);

    // Catat caption yang dipakai, supaya meme ini tampil dengan caption itu di galeri.
    // Caption tulisan sendiri tidak disimpan (belum ada moderasi), jadi dicatat sebagai "tanpa caption".
    if (result) {
      void recordCaptionChoice(result.memeId, choice.kind === "ai" && withCaption ? choice.index : null);
    }

    try {
      const blob = await (await fetch(shownImage)).blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const suffix = !withCaption ? "" : choice.kind === "ai" ? `-caption-${choice.index + 1}` : "-custom";
      const extension = shownImage.startsWith("data:image/png") ? "png" : "jpg";
      link.download = `${fileStem}${suffix}.${extension}`;
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
      <Card
        icon={ImageIcon}
        title="Your meme"
        right={cooking ? "Cooking…" : loreName ? `${loreName} lore` : "Free meme"}
      >
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
              {!cooking && shownImage && (
                <>
                  <Image
                    src={shownImage}
                    alt={withCaption ? `Meme with the caption: ${captionText}` : "Meme picture without a caption"}
                    width={1024}
                    height={1024}
                    unoptimized
                    className="size-full object-cover"
                  />
                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Back to your kitchen"
                      className="absolute top-2 left-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-bg/80 px-3 py-1.5 text-xs font-bold text-ink backdrop-blur-sm transition-colors hover:border-line-hover hover:bg-bg"
                    >
                      <ArrowLeft className="size-3.5" />
                      <span>Back</span>
                    </button>
                  )}
                  {updating && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-bg/80 px-2.5 py-1 text-[11px] text-muted">
                      <Loader2 className="size-3 animate-spin" />
                      Updating
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Caption + tombol */}
            <div className="flex min-w-0 flex-col gap-4">
              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className="sr-only">Add a caption to your meme (optional)</legend>
                <p className="text-[10px] font-bold tracking-[0.12em] text-dim uppercase">
                  {cooking ? "Writing captions" : "Caption (optional)"}
                </p>
                {cooking ? (
                  Array.from({ length: CAPTION_COUNT }, (_, index) => <SkeletonRow key={index} index={index} />)
                ) : (
                  <>
                    <OptionRow
                      name={groupName}
                      selected={choice.kind === "none"}
                      onSelect={() => onChoose({ kind: "none" })}
                    >
                      <span className="min-w-0 flex-1 text-sm text-muted">No caption, just the picture</span>
                    </OptionRow>

                    {result?.captions.map((caption, index) => (
                      <OptionRow
                        key={`${index}-${caption}`}
                        name={groupName}
                        selected={choice.kind === "ai" && choice.index === index}
                        onSelect={() => onChoose({ kind: "ai", index })}
                        after={<CopyButton text={caption} />}
                      >
                        <span className="min-w-0 flex-1 text-sm leading-snug break-words text-ink">{caption}</span>
                      </OptionRow>
                    ))}

                    <CustomCaptionRow
                      name={groupName}
                      selected={choice.kind === "custom"}
                      onSelect={() => onChoose({ kind: "custom" })}
                      text={customCaption}
                      onTextChange={onCustomCaptionChange}
                    />
                  </>
                )}
              </fieldset>

              {!cooking && result && (
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={download}
                    disabled={!canDownload}
                    className={`${primaryButton} w-full`}
                  >
                    {updating ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    <span>Download</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2.5">
                    {onCookAgain && (
                      <button
                        type="button"
                        onClick={onCookAgain}
                        disabled={cookAgainDisabled}
                        className={secondaryButton}
                      >
                        <RefreshCw className="size-4" />
                        <span>Cook again</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setServing(true)}
                      className={`${secondaryButton} ${onCookAgain ? "" : "col-span-2"}`}
                    >
                      <Rocket className="size-4" />
                      <span>Serve as coin</span>
                    </button>
                  </div>

                  {hint && <p className="text-center font-mono text-xs text-dim">{hint}</p>}
                  {renderFailed && (
                    <p role="alert" className="text-center text-[13px] text-warn">
                      Couldn&apos;t draw the caption. Check your connection and try again.
                    </p>
                  )}
                  {downloadFailed && (
                    <p role="alert" className="text-center text-[13px] text-warn">
                      Download failed. Right-click the image and save it instead.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {serving && result && (
        <ServeDialog
          memeId={result.memeId}
          picture={result.picture}
          caption={withCaption ? captionText : ""}
          suggestedName={loreName ?? undefined}
          onClose={() => setServing(false)}
        />
      )}
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

function rowClass(selected: boolean) {
  return `rounded-[10px] border transition-colors ${
    selected ? "border-accent bg-accent-soft" : "border-line hover:border-line-hover"
  }`;
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-4.5 flex-none items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-panel ${
        selected ? "border-accent" : "border-line-hover"
      }`}
    >
      {selected && <span className="size-2 rounded-full bg-accent" />}
    </span>
  );
}

type OptionRowProps = {
  name: string;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  /** Elemen di kanan baris, di luar label (misalnya tombol copy). */
  after?: React.ReactNode;
};

function OptionRow({ name, selected, onSelect, children, after }: OptionRowProps) {
  return (
    <div className={`flex min-h-12 items-center gap-2 pr-2 ${rowClass(selected)}`}>
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pl-3">
        <input type="radio" name={name} checked={selected} onChange={onSelect} className="peer sr-only" />
        <RadioDot selected={selected} />
        {children}
      </label>
      {after}
    </div>
  );
}

type CustomCaptionRowProps = {
  name: string;
  selected: boolean;
  onSelect: () => void;
  text: string;
  onTextChange: (text: string) => void;
};

function CustomCaptionRow({ name, selected, onSelect, text, onTextChange }: CustomCaptionRowProps) {
  return (
    <div className={rowClass(selected)}>
      <label className="flex cursor-pointer items-center gap-3 px-3 pt-3 pb-2">
        <input type="radio" name={name} checked={selected} onChange={onSelect} className="peer sr-only" />
        <RadioDot selected={selected} />
        <span className="inline-flex items-center gap-1.5 text-sm text-ink">
          <PenLine className="size-3.5 text-dim" />
          Write your own
        </span>
      </label>
      <div className="px-3 pb-3">
        <textarea
          aria-label="Your own caption"
          value={text}
          onFocus={() => {
            if (!selected) onSelect();
          }}
          onChange={(event) => {
            onTextChange(event.target.value);
            if (!selected) onSelect();
          }}
          onKeyDown={(event) => {
            // Cukup satu Enter: baris pertama di atas, sisanya di bawah.
            if (event.key === "Enter" && text.includes("\n")) event.preventDefault();
          }}
          maxLength={CUSTOM_CAPTION_MAX_LENGTH}
          rows={2}
          placeholder={"top text\nbottom text"}
          className="w-full resize-none rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-dim focus:border-accent focus:outline-hidden"
        />
        <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-dim">
          <span>Press Enter to split top and bottom text</span>
          <span className={`font-mono ${text.length >= CUSTOM_CAPTION_MAX_LENGTH ? "text-warn" : ""}`}>
            {text.length}/{CUSTOM_CAPTION_MAX_LENGTH}
          </span>
        </div>
      </div>
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
