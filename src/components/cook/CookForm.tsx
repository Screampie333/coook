"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { Flame, Loader2, Sparkles, Wallet } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { authFetch } from "@/components/auth/hooks";
import { usePrivyEnabled } from "@/components/auth/PrivyProviders";
import { Card } from "@/components/ui/Card";
import {
  CAPTION_COUNT,
  IDEA_MAX_LENGTH,
  IMAGE_DAILY_LIMIT,
  isImageQuota,
  normalizeIdea,
  type ImageQuota,
} from "@/lib/cook/limits";
import { MemeCard, type CaptionChoice, type CookedResult } from "./MemeCard";
import { setImageQuota, useImageQuota } from "./quota-store";

type AuthState =
  | { status: "unavailable" }
  | { status: "loading" }
  | { status: "signed_out"; login: () => void }
  | { status: "signed_in" };

/** Alur Cook di halaman "/": ketik ide → gambar → 3 caption, semua dalam satu klik. */
export function CookForm() {
  const enabled = usePrivyEnabled();
  if (!enabled) return <CookPanel auth={{ status: "unavailable" }} />;
  return <PrivyCookForm />;
}

function PrivyCookForm() {
  const { ready, authenticated } = usePrivy();
  // Tanpa callback: pesan error login sudah ditampilkan oleh tombol Connect di sidebar/top bar.
  const { login } = useLogin();

  if (!ready) return <CookPanel auth={{ status: "loading" }} />;
  if (!authenticated) return <CookPanel auth={{ status: "signed_out", login: () => login() }} />;
  return <CookPanel auth={{ status: "signed_in" }} />;
}

// Batas lama tombol dikunci setelah kena rate limit.
const MAX_COOLDOWN_SECONDS = 60;
const DEFAULT_COOLDOWN_SECONDS = 10;

const RATE_LIMIT_MESSAGE = "The kitchen is packed right now. Try again in a moment.";
const SESSION_EXPIRED_MESSAGE = "Your session expired. Connect your wallet again.";
const NETWORK_MESSAGE = "Couldn't reach the kitchen. Check your connection and try again.";

const primaryButton =
  "inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

function CookPanel({ auth }: { auth: AuthState }) {
  const [idea, setIdea] = useState("");
  const [cooking, setCooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hasil Cook terakhir. Default tanpa caption; tulisan custom tetap disimpan antar-Cook.
  const [cooked, setCooked] = useState<CookedResult | null>(null);
  const [choice, setChoice] = useState<CaptionChoice>({ kind: "none" });
  const [customCaption, setCustomCaption] = useState("");
  const [cookedIdea, setCookedIdea] = useState<string | null>(null);
  const [fileStem, setFileStem] = useState("kuk-meme");

  // Kunci sementara
  const [cooldown, setCooldown] = useState(0);
  const [ovenClosedUntil, setOvenClosedUntil] = useState<string | null>(null);

  const quota = useImageQuota();
  const inputId = useId();

  // Hitung mundur detik setelah rate limit.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Kuota gambar gratis habis: buka lagi otomatis saat jam reset.
  useEffect(() => {
    if (!ovenClosedUntil) return;
    const wait = new Date(ovenClosedUntil).getTime() - Date.now();
    const timer = setTimeout(() => setOvenClosedUntil(null), Math.min(Math.max(wait, 0), 2_000_000_000));
    return () => clearTimeout(timer);
  }, [ovenClosedUntil]);

  const signedIn = auth.status === "signed_in";
  const outOfMemes = quota !== null && quota.remaining <= 0;
  const ovenClosed = ovenClosedUntil !== null;
  const ready = signedIn && !cooking && cooldown === 0 && !outOfMemes && !ovenClosed;
  const canCook = ready && normalizeIdea(idea).length > 0;
  const canCookAgain = ready && cookedIdea !== null;

  async function cook(ideaToCook: string) {
    const cleanIdea = normalizeIdea(ideaToCook);
    if (!ready || !cleanIdea) return;

    setCooking(true);
    setError(null);
    try {
      const result = await requestMeme(cleanIdea);
      if (result.quota) setImageQuota(result.quota);
      if (result.ok) {
        setCooked(result.cooked);
        setChoice({ kind: "none" });
        setCookedIdea(cleanIdea);
        setFileStem(memeFileStem());
      } else {
        setError(result.message);
        if (result.rateLimited) {
          setCooldown(
            Math.min(MAX_COOLDOWN_SECONDS, Math.max(1, result.retryAfterSeconds ?? DEFAULT_COOLDOWN_SECONDS)),
          );
        }
        if (result.ovenClosedUntil) setOvenClosedUntil(result.ovenClosedUntil);
      }
    } finally {
      setCooking(false);
    }
  }

  const length = idea.length;
  const counterColor =
    length >= IDEA_MAX_LENGTH ? "text-warn" : length >= IDEA_MAX_LENGTH - 20 ? "text-accent" : "text-dim";

  const buttonLabel = cooking
    ? "Cooking…"
    : ovenClosed
      ? "Oven's closed"
      : outOfMemes
        ? "No memes left today"
        : cooldown > 0
          ? `Wait ${cooldown}s`
          : "Cook";

  return (
    <>
      <Card icon={Sparkles} title="New meme" right={`1 picture · ${CAPTION_COUNT} captions`}>
        <form
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void cook(idea);
          }}
        >
          <label htmlFor={inputId} className="text-[10px] font-bold tracking-[0.12em] text-dim uppercase">
            Your idea
          </label>
          <textarea
            id={inputId}
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void cook(idea);
              }
            }}
            maxLength={IDEA_MAX_LENGTH}
            rows={3}
            disabled={cooking}
            placeholder="my cat aped into a coin named after himself"
            className="w-full resize-none rounded-[10px] border border-line bg-panel-2 px-3.5 py-3 text-[15px] text-ink placeholder:text-dim focus:border-accent focus:ring-2 focus:ring-accent-soft focus:outline-hidden disabled:opacity-60"
          />

          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="hidden text-dim sm:inline">Ctrl + Enter to cook</span>
            <span className={`ml-auto font-mono ${counterColor}`} aria-live="polite">
              {length}/{IDEA_MAX_LENGTH}
            </span>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <StatusNote auth={auth} quota={quota} ovenClosedUntil={ovenClosedUntil} />
            {auth.status === "signed_out" ? (
              <button type="button" onClick={auth.login} className={primaryButton}>
                <Wallet className="size-4" />
                <span>Connect to cook</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canCook}
                aria-busy={cooking}
                className={primaryButton}
              >
                {cooking || auth.status === "loading" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Flame className="size-4" />
                )}
                <span>{signedIn ? buttonLabel : "Cook"}</span>
              </button>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-[10px] border border-warn/40 bg-warn/10 px-3 py-2.5 text-[13px] text-warn"
            >
              {error}
            </p>
          )}
        </form>
      </Card>

      {(cooking || cooked) && (
        <MemeCard
          key={fileStem}
          cooking={cooking}
          result={cooked}
          choice={choice}
          onChoose={setChoice}
          customCaption={customCaption}
          onCustomCaptionChange={setCustomCaption}
          onCookAgain={() => {
            if (cookedIdea) void cook(cookedIdea);
          }}
          cookAgainDisabled={!canCookAgain}
          hint={quota ? `Cook again uses 1 meme · ${quota.remaining} left today` : undefined}
          fileStem={fileStem}
        />
      )}
    </>
  );
}

function StatusNote({
  auth,
  quota,
  ovenClosedUntil,
}: {
  auth: AuthState;
  quota: ImageQuota | null;
  ovenClosedUntil: string | null;
}) {
  switch (auth.status) {
    case "unavailable":
      return <p className="text-xs text-warn">Login isn&apos;t configured, so cooking is off.</p>;
    case "loading":
      return <p className="text-xs text-dim">Checking your wallet…</p>;
    case "signed_out":
      return <p className="text-xs text-dim">Connect your Solana wallet to start cooking.</p>;
  }

  if (ovenClosedUntil) {
    return <p className="text-xs text-warn">The oven is out of gas. Back {resetPhrase(ovenClosedUntil)}.</p>;
  }
  if (quota && quota.remaining <= 0) {
    return <p className="text-xs text-warn">Out of memes for today. Back {resetPhrase(quota.resetsAt)}.</p>;
  }
  return (
    <p className="font-mono text-xs text-dim">
      {quota
        ? `${quota.remaining} of ${quota.limit} memes left · resets ${resetPhrase(quota.resetsAt)}`
        : `${IMAGE_DAILY_LIMIT} memes per wallet per day`}
    </p>
  );
}

/** Awalan nama file download, misalnya kuk-meme-2026-09-17-143005 */
function memeFileStem() {
  const stamp = new Date().toISOString().slice(0, 19).replace("T", "-").replace(/:/g, "");
  return `kuk-meme-${stamp}`;
}

/** "at 07:00" dalam jam lokal user, atau kalimat umum kalau waktunya tidak diketahui. */
function resetPhrase(resetsAt: unknown) {
  const date = typeof resetsAt === "string" ? new Date(resetsAt) : null;
  if (!date || Number.isNaN(date.getTime())) return "after the daily reset";
  return `at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

type CookResult =
  | { ok: true; cooked: CookedResult; quota: ImageQuota | null }
  | {
      ok: false;
      message: string;
      quota: ImageQuota | null;
      rateLimited?: boolean;
      retryAfterSeconds?: number;
      ovenClosedUntil?: string;
    };

/** Mengecek bentuk hasil Cook dari API: id meme + URL gambar + 3 caption. */
function parseCooked(value: unknown): CookedResult | null {
  const meme = value as { id?: unknown; imageUrl?: unknown; captions?: unknown } | null;
  if (typeof meme?.id !== "string" || typeof meme.imageUrl !== "string") return null;
  if (!meme.imageUrl.startsWith("http")) return null;

  const captions = meme.captions;
  if (
    !Array.isArray(captions) ||
    captions.length !== CAPTION_COUNT ||
    !captions.every((caption): caption is string => typeof caption === "string")
  ) {
    return null;
  }
  return { memeId: meme.id, picture: meme.imageUrl, captions };
}

/** Memanggil POST /api/cook. Tidak pernah melempar error; semua kegagalan jadi pesan yang jelas. */
async function requestMeme(idea: string): Promise<CookResult> {
  let response: Response;
  try {
    response = await authFetch("/api/cook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });
  } catch {
    return { ok: false, quota: null, message: NETWORK_MESSAGE };
  }

  const body = (await response.json().catch(() => null)) as {
    meme?: unknown;
    error?: unknown;
    code?: unknown;
    retryAfterSeconds?: unknown;
    resetsAt?: unknown;
    quota?: unknown;
  } | null;
  const quota = isImageQuota(body?.quota) ? body.quota : null;

  if (response.ok) {
    const cooked = parseCooked(body?.meme);
    if (cooked) return { ok: true, cooked, quota };
  }

  if (response.status === 401) {
    return { ok: false, quota, message: SESSION_EXPIRED_MESSAGE };
  }

  if (body?.code === "daily_limit") {
    return {
      ok: false,
      quota,
      message: `You've cooked ${quota?.limit ?? IMAGE_DAILY_LIMIT} memes today. Come back ${resetPhrase(body.resetsAt)}.`,
    };
  }

  if (body?.code === "quota_exhausted") {
    return {
      ok: false,
      quota,
      message: `The oven is out of gas for today. Cooking is back ${resetPhrase(body.resetsAt)}.`,
      ovenClosedUntil: typeof body.resetsAt === "string" ? body.resetsAt : undefined,
    };
  }

  if (body?.code === "rate_limited" || response.status === 429) {
    const retryAfter = typeof body?.retryAfterSeconds === "number" ? body.retryAfterSeconds : undefined;
    return {
      ok: false,
      quota,
      rateLimited: true,
      retryAfterSeconds: retryAfter,
      message:
        retryAfter && retryAfter > MAX_COOLDOWN_SECONDS
          ? `The kitchen is packed right now. Try again in about ${Math.ceil(retryAfter / 60)} min.`
          : RATE_LIMIT_MESSAGE,
    };
  }

  return {
    ok: false,
    quota,
    message: typeof body?.error === "string" ? body.error : "Something went wrong. Try again.",
  };
}
