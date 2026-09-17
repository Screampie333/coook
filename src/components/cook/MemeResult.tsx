"use client";

import { Download, ImageIcon, Loader2, RefreshCw, Rocket } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Card } from "@/components/ui/Card";

export type Meme = {
  /** data URL JPEG yang sudah ada caption-nya. */
  image: string;
  caption: string;
  captionIndex: number;
  fileName: string;
};

type MemeResultProps = {
  cooking: boolean;
  meme: Meme | null;
  onCookAgain: () => void;
  cookAgainDisabled: boolean;
  /** Info kecil di bawah tombol, misalnya sisa jatah. */
  hint?: string;
};

const buttonBase =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const primaryButton = `${buttonBase} bg-accent text-bg hover:opacity-90`;
const secondaryButton = `${buttonBase} border border-line bg-panel text-ink hover:border-line-hover disabled:hover:border-line`;

/** Kartu hasil meme: loading, gambar, dan tombol Download / Cook again / Serve as coin. */
export function MemeResult({ cooking, meme, onCookAgain, cookAgainDisabled, hint }: MemeResultProps) {
  const [showServeNote, setShowServeNote] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);

  async function download() {
    if (!meme) return;
    setDownloadFailed(false);
    try {
      const blob = await (await fetch(meme.image)).blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = meme.fileName;
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
      <Card icon={ImageIcon} title="Your meme" right={cooking ? "Cooking…" : "Fresh out of the oven"}>
        <div className="p-4">
          <div className="relative mx-auto aspect-square w-full max-w-[512px] overflow-hidden rounded-xl border border-line bg-panel-2">
            {cooking && (
              <>
                <div className="absolute inset-0 animate-pulse bg-panel-2 motion-reduce:animate-none" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <Loader2 className="size-6 animate-spin text-accent" />
                  <p className="text-sm font-bold text-ink">Cooking your meme…</p>
                  <p className="max-w-[30ch] text-xs text-dim">
                    Writing the scene, firing up the oven, slapping on the caption. About 10 seconds.
                  </p>
                </div>
              </>
            )}
            {!cooking && meme && (
              <Image
                src={meme.image}
                alt={`Meme with the caption: ${meme.caption}`}
                width={1024}
                height={1024}
                unoptimized
                className="size-full object-cover"
              />
            )}
          </div>

          {!cooking && meme && (
            <>
              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                <button type="button" onClick={download} className={primaryButton}>
                  <Download className="size-4" />
                  <span>Download</span>
                </button>
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

              {hint && <p className="mt-3 text-center font-mono text-xs text-dim">{hint}</p>}
              {downloadFailed && (
                <p role="alert" className="mt-2 text-center text-[13px] text-warn">
                  Download failed. Right-click the image and save it instead.
                </p>
              )}
              {showServeNote && (
                <p role="status" className="mt-2 text-center text-[13px] text-muted">
                  Serving memes as pump.fun coins is coming soon.
                </p>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
