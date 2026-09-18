"use client";

import { Coins, CookingPot, ExternalLink, Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { authFetch } from "@/components/auth/hooks";
import { Card, CardEmpty } from "@/components/ui/Card";
import type { LaunchSummary, MemeSummary } from "@/lib/cook/meme-types";
import { shortenAddress } from "@/lib/format";
import { coinUrl } from "@/lib/launch/links";
import { recordCaptionChoice } from "./caption-choice";
import { MemeCard, type CaptionChoice } from "./MemeCard";
import { MemeGridCard } from "./MemeGridCard";

/** Isi halaman /kitchen: meme milik user yang login + koin yang pernah dia mint. */
export function KitchenContent() {
  const [memes, setMemes] = useState<MemeSummary[] | null>(null);
  const [launches, setLaunches] = useState<LaunchSummary[]>([]);
  const [pageSize, setPageSize] = useState(24);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Meme yang sedang diedit ulang (ganti caption lalu download lagi).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [choice, setChoice] = useState<CaptionChoice>({ kind: "none" });
  const [customCaption, setCustomCaption] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  useEffect(() => {
    let cancelled = false;
    fetchKitchen().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setMemes(result.memes);
        setLaunches(result.launches);
        setPageSize(result.pageSize);
        setHasMore(result.memes.length === result.pageSize);
        setError(null);
      } else {
        setError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  async function loadMore() {
    const last = memes?.[memes.length - 1];
    if (!last || loadingMore) return;

    setLoadingMore(true);
    const result = await fetchKitchen(last.createdAt);
    setLoadingMore(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMemes((current) => [...(current ?? []), ...result.memes]);
    setHasMore(result.memes.length === pageSize);
  }

  function startEditing(meme: MemeSummary) {
    setEditingId(meme.id);
    // Mulai dari caption yang tersimpan terakhir.
    setChoice(meme.captionIndex === null ? { kind: "none" } : { kind: "ai", index: meme.captionIndex });
    setCustomCaption("");
    setSaveState("idle");
  }

  /** Pilihan caption di Kitchen langsung disimpan, jadi galeri ikut berubah. */
  function chooseCaption(next: CaptionChoice) {
    setChoice(next);
    if (!editingId) return;

    // Caption tulisan sendiri tidak disimpan (belum ada moderasi), jadi dicatat sebagai "tanpa caption".
    const captionIndex = next.kind === "ai" ? next.index : null;
    setSaveState("saving");
    void recordCaptionChoice(editingId, captionIndex).then((ok) => {
      setSaveState(ok ? "saved" : "failed");
      if (!ok) return;
      setMemes((current) =>
        (current ?? []).map((meme) => (meme.id === editingId ? { ...meme, captionIndex } : meme)),
      );
    });
  }

  if (error) {
    return (
      <Card icon={CookingPot} title="Your memes">
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-[13px] text-warn">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm font-bold text-ink hover:border-line-hover"
          >
            Try again
          </button>
        </div>
      </Card>
    );
  }

  if (!memes) {
    return (
      <Card icon={CookingPot} title="Your memes">
        <div className="flex items-center justify-center gap-2 px-4 py-12 text-[13px] text-dim">
          <Loader2 className="size-4 animate-spin" />
          <span>Opening your kitchen…</span>
        </div>
      </Card>
    );
  }

  const editing = editingId ? (memes.find((meme) => meme.id === editingId) ?? null) : null;

  // Mode edit: satu meme lama dibuka di editor caption yang sama seperti setelah Cook.
  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted">
            Editing a meme from <time dateTime={editing.createdAt}>{formatDate(editing.createdAt)}</time>. The
            picture stays the same, so this costs nothing.
          </p>
          <span className="font-mono text-xs text-dim">
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "Caption saved"}
            {saveState === "failed" && <span className="text-warn">Couldn&apos;t save the caption</span>}
          </span>
        </div>

        <MemeCard
          cooking={false}
          result={{ memeId: editing.id, picture: editing.imageUrl, captions: editing.captions }}
          choice={choice}
          onChoose={chooseCaption}
          customCaption={customCaption}
          onCustomCaptionChange={setCustomCaption}
          onClose={() => setEditingId(null)}
          fileStem={memeFileStem(editing.createdAt)}
          loreName={editing.loreName}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <Card icon={CookingPot} title="Your memes" right={<span className="font-mono">{memes.length}</span>}>
          {memes.length === 0 ? (
            <CardEmpty>The pot is empty. Cook your first meme on the Cook page.</CardEmpty>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
              {memes.map((meme) => (
                <MemeGridCard
                  key={meme.id}
                  meme={meme}
                  action={
                    <button
                      type="button"
                      onClick={() => startEditing(meme)}
                      className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-bold text-ink transition-colors hover:border-line-hover"
                    >
                      <Pencil className="size-3.5" />
                      <span>Edit caption</span>
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </Card>

        {hasMore && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-bold text-ink hover:border-line-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMore && <Loader2 className="size-4 animate-spin" />}
              <span>{loadingMore ? "Loading…" : "Older memes"}</span>
            </button>
          </div>
        )}
      </section>

      <section>
        <Card icon={Coins} title="Your coins" right={<span className="font-mono">{launches.length}</span>}>
          {launches.length === 0 ? (
            <CardEmpty>No coins served yet. Open a meme and hit Serve as coin to make one.</CardEmpty>
          ) : (
            <ul>
              {launches.map((launch) => (
                <li
                  key={launch.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 text-sm last:border-b-0"
                >
                  <a
                    href={coinUrl(launch.mintAddress, launch.cluster)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-bold text-ink underline-offset-2 hover:text-accent hover:underline"
                  >
                    {launch.name}
                    <ExternalLink className="size-3 text-dim" />
                  </a>
                  <span className="font-mono text-xs text-accent">${launch.ticker}</span>
                  <span className="font-mono text-xs text-dim" title={launch.mintAddress}>
                    {shortenAddress(launch.mintAddress)}
                  </span>
                  {launch.cluster === "devnet" && (
                    <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-bold tracking-wide text-dim uppercase">
                      devnet test
                    </span>
                  )}
                  <time dateTime={launch.createdAt} className="ml-auto text-xs text-dim">
                    {formatDate(launch.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Nama file download memakai tanggal meme itu dibuat. */
function memeFileStem(iso: string) {
  const stamp = new Date(iso).toISOString().slice(0, 19).replace("T", "-").replace(/:/g, "");
  return `coook-meme-${stamp}`;
}

type KitchenResult =
  | { ok: true; memes: MemeSummary[]; launches: LaunchSummary[]; pageSize: number }
  | { ok: false; message: string };

/** Memanggil GET /api/kitchen. Tidak pernah melempar error. */
async function fetchKitchen(before?: string): Promise<KitchenResult> {
  try {
    const url = before ? `/api/kitchen?before=${encodeURIComponent(before)}` : "/api/kitchen";
    const response = await authFetch(url);
    const body = (await response.json().catch(() => null)) as {
      memes?: unknown;
      launches?: unknown;
      pageSize?: unknown;
      error?: unknown;
    } | null;

    if (response.status === 401) {
      return { ok: false, message: "Your session expired. Connect your wallet again." };
    }
    if (!response.ok || !Array.isArray(body?.memes) || !Array.isArray(body.launches)) {
      return {
        ok: false,
        message: typeof body?.error === "string" ? body.error : "Couldn't open your kitchen. Try again.",
      };
    }

    return {
      ok: true,
      memes: body.memes as MemeSummary[],
      launches: body.launches as LaunchSummary[],
      pageSize: typeof body.pageSize === "number" ? body.pageSize : 24,
    };
  } catch {
    return { ok: false, message: "Couldn't reach the kitchen. Check your connection and try again." };
  }
}
