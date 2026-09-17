import Image from "next/image";
import { captionBlocks } from "@/lib/cook/caption-layout";
import type { MemeSummary } from "@/lib/cook/meme-types";
import { shortenAddress } from "@/lib/format";

/**
 * Satu kartu meme di galeri (/menu dan /kitchen).
 * Caption yang tampil adalah caption yang dipilih pembuatnya saat Download.
 * Caption tulisan sendiri tidak ditampilkan di sini karena belum ada moderasi.
 */
export function MemeGridCard({ meme }: { meme: MemeSummary }) {
  const caption = meme.captionIndex === null ? null : (meme.captions[meme.captionIndex] ?? null);
  const blocks = caption ? captionBlocks(caption) : null;

  return (
    <article className="overflow-hidden rounded-card border border-line bg-panel">
      <div className="@container relative aspect-square w-full bg-panel-2">
        <Image
          src={meme.imageUrl}
          alt={caption ?? "Meme picture"}
          width={1024}
          height={1024}
          unoptimized
          loading="lazy"
          className="size-full object-cover"
        />
        {blocks?.top && (
          <p className="meme-caption absolute inset-x-[4%] top-[3.5%] text-center text-[8cqw]">{blocks.top}</p>
        )}
        {blocks?.bottom && (
          <p className="meme-caption absolute inset-x-[4%] bottom-[3.5%] text-center text-[8cqw]">{blocks.bottom}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-xs">
        {meme.loreName ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-bold text-accent">{meme.loreName}</span>
        ) : (
          <span className="rounded-full border border-line px-2 py-0.5 text-dim">Free meme</span>
        )}
        <span className="font-mono text-dim" title={meme.walletAddress}>
          {shortenAddress(meme.walletAddress)}
        </span>
        <time dateTime={meme.createdAt} className="ml-auto text-dim">
          {formatDate(meme.createdAt)}
        </time>
      </div>

      {meme.idea && <p className="border-t border-line px-3 py-2 text-[13px] text-muted">{meme.idea}</p>}
    </article>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
