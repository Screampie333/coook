"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { Flame, ImagePlus, Loader2, Sparkles, Wallet } from "lucide-react";
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
import { CaptionList } from "./CaptionList";
import { MemeResult, type Meme } from "./MemeResult";
import { setImageQuota, useImageQuota } from "./quota-store";

type AuthState =
  | { status: "unavailable" }
  | { status: "loading" }
  | { status: "signed_out"; login: () => void }
  | { status: "signed_in" };

/** Alur Cook di halaman "/": ide → 3 caption → pilih satu → meme. */
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
  // Langkah 1: ide → caption
  const [idea, setIdea] = useState("");
  const [cooking, setCooking] = useState(false);
  const [captions, setCaptions] = useState<string[] | null>(null);
  const [captionToken, setCaptionToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Langkah 2: caption → meme
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [memeCooking, setMemeCooking] = useState(false);
  const [meme, setMeme] = useState<Meme | null>(null);
  const [memeError, setMemeError] = useState<string | null>(null);

  // Hitung mundur setelah rate limit (berlaku untuk kedua tombol).
  const [cooldown, setCooldown] = useState(0);
  const quota = useImageQuota();
  const inputId = useId();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function startCooldown(seconds?: number) {
    setCooldown(Math.min(MAX_COOLDOWN_SECONDS, Math.max(1, seconds ?? DEFAULT_COOLDOWN_SECONDS)));
  }

  const signedIn = auth.status === "signed_in";
  const busy = cooking || memeCooking;
  const hasIdea = normalizeIdea(idea).length > 0;
  const canCook = signedIn && hasIdea && !busy && cooldown === 0;

  const outOfMemes = quota !== null && quota.remaining <= 0;
  const canCookMeme = signedIn && captionToken !== null && !busy && cooldown === 0 && !outOfMemes;

  async function cook() {
    if (!canCook) return;

    setCooking(true);
    setError(null);
    setCaptions(null);
    setCaptionToken(null);
    setSelectedIndex(null);
    setMeme(null);
    setMemeError(null);
    try {
      const result = await requestCaptions(normalizeIdea(idea));
      if (result.ok) {
        setCaptions(result.captions);
        setCaptionToken(result.captionToken);
      } else {
        setError(result.message);
        if (result.rateLimited) startCooldown(result.retryAfterSeconds);
      }
    } finally {
      setCooking(false);
    }
  }

  async function cookMeme(captionIndex: number | null) {
    if (!canCookMeme || captionToken === null || captionIndex === null) return;

    setSelectedIndex(captionIndex);
    setMemeCooking(true);
    setMemeError(null);
    setMeme(null);
    try {
      const result = await requestMeme(captionToken, captionIndex);
      if (result.quota) setImageQuota(result.quota);
      if (result.ok) {
        setMeme({ image: result.image, caption: result.caption, captionIndex, fileName: memeFileName() });
      } else {
        setMemeError(result.message);
        if (result.rateLimited) startCooldown(result.retryAfterSeconds);
      }
    } finally {
      setMemeCooking(false);
    }
  }

  const length = idea.length;
  const counterColor =
    length >= IDEA_MAX_LENGTH ? "text-warn" : length >= IDEA_MAX_LENGTH - 20 ? "text-accent" : "text-dim";

  const quotaLabel = quota
    ? `${quota.remaining} of ${quota.limit} memes left today`
    : `${IMAGE_DAILY_LIMIT} memes per wallet per day`;

  const memeButtonLabel = memeCooking
    ? "Cooking meme…"
    : outOfMemes
      ? "No memes left today"
      : cooldown > 0
        ? `Wait ${cooldown}s`
        : selectedIndex === null
          ? "Pick a caption"
          : "Cook meme";

  return (
    <>
      <Card icon={Sparkles} title="New meme" right={`${CAPTION_COUNT} captions per cook`}>
        <form
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void cook();
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
                void cook();
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
            <AuthNote auth={auth} />
            <CookButton auth={auth} cooking={cooking} cooldown={cooldown} disabled={signedIn && !canCook} />
          </div>

          {error && <ErrorBox message={error} />}
        </form>
      </Card>

      {(cooking || captions) && (
        <CaptionList
          captions={captions}
          cooking={cooking}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          selectionDisabled={memeCooking}
          footer={
            <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-mono text-xs text-dim">{quotaLabel}</span>
                <button
                  type="button"
                  onClick={() => void cookMeme(selectedIndex)}
                  disabled={!canCookMeme || selectedIndex === null}
                  aria-busy={memeCooking}
                  className={primaryButton}
                >
                  {memeCooking ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                  <span>{memeButtonLabel}</span>
                </button>
              </div>
              {memeError && <ErrorBox message={memeError} />}
            </div>
          }
        />
      )}

      {(memeCooking || meme) && (
        <MemeResult
          cooking={memeCooking}
          meme={meme}
          onCookAgain={() => void cookMeme(meme?.captionIndex ?? null)}
          cookAgainDisabled={!canCookMeme}
          hint={quota ? `Cook again uses 1 meme · ${quota.remaining} left today` : undefined}
        />
      )}
    </>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-[10px] border border-warn/40 bg-warn/10 px-3 py-2.5 text-[13px] text-warn">
      {message}
    </p>
  );
}

function AuthNote({ auth }: { auth: AuthState }) {
  switch (auth.status) {
    case "unavailable":
      return <p className="text-xs text-warn">Login isn&apos;t configured, so cooking is off.</p>;
    case "loading":
      return <p className="text-xs text-dim">Checking your wallet…</p>;
    case "signed_out":
      return <p className="text-xs text-dim">Connect your Solana wallet to start cooking.</p>;
    default:
      return <span />;
  }
}

type CookButtonProps = {
  auth: AuthState;
  cooking: boolean;
  cooldown: number;
  disabled: boolean;
};

function CookButton({ auth, cooking, cooldown, disabled }: CookButtonProps) {
  if (auth.status === "signed_out") {
    return (
      <button type="button" onClick={auth.login} className={primaryButton}>
        <Wallet className="size-4" />
        <span>Connect to cook</span>
      </button>
    );
  }

  if (auth.status !== "signed_in") {
    return (
      <button type="button" disabled className={primaryButton}>
        {auth.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Flame className="size-4" />}
        <span>Cook</span>
      </button>
    );
  }

  return (
    <button type="submit" disabled={disabled} aria-busy={cooking} className={primaryButton}>
      {cooking ? <Loader2 className="size-4 animate-spin" /> : <Flame className="size-4" />}
      <span>{cooking ? "Cooking…" : cooldown > 0 ? `Wait ${cooldown}s` : "Cook"}</span>
    </button>
  );
}

/** Nama file download, misalnya coook-meme-2026-09-17-143005.jpg */
function memeFileName() {
  const stamp = new Date().toISOString().slice(0, 19).replace("T", "-").replace(/:/g, "");
  return `coook-meme-${stamp}.jpg`;
}

/** "at 07:00" dalam jam lokal user, atau kalimat umum kalau waktunya tidak diketahui. */
function resetPhrase(resetsAt: unknown) {
  const date = typeof resetsAt === "string" ? new Date(resetsAt) : null;
  if (!date || Number.isNaN(date.getTime())) return "after the daily reset";
  return `at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

type ApiErrorBody = {
  error?: unknown;
  code?: unknown;
  retryAfterSeconds?: unknown;
  resetsAt?: unknown;
  quota?: unknown;
};

type Failure = { ok: false; message: string; rateLimited: boolean; retryAfterSeconds?: number };

/** Pesan untuk error yang sama di kedua API. */
function commonFailure(response: Response, body: ApiErrorBody | null): Failure {
  const serverMessage = typeof body?.error === "string" ? body.error : null;

  if (response.status === 401) {
    return { ok: false, rateLimited: false, message: SESSION_EXPIRED_MESSAGE };
  }

  if (body?.code === "rate_limited" || response.status === 429) {
    const retryAfter = typeof body?.retryAfterSeconds === "number" ? body.retryAfterSeconds : undefined;
    const message =
      retryAfter && retryAfter > MAX_COOLDOWN_SECONDS
        ? `The kitchen is packed right now. Try again in about ${Math.ceil(retryAfter / 60)} min.`
        : (serverMessage ?? RATE_LIMIT_MESSAGE);
    return { ok: false, rateLimited: true, retryAfterSeconds: retryAfter, message };
  }

  return { ok: false, rateLimited: false, message: serverMessage ?? "Something went wrong. Try again." };
}

type CaptionsResult = { ok: true; captions: string[]; captionToken: string } | Failure;

/** Memanggil API caption. Tidak pernah melempar error; semua kegagalan jadi pesan yang jelas. */
async function requestCaptions(idea: string): Promise<CaptionsResult> {
  let response: Response;
  try {
    response = await authFetch("/api/cook/captions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });
  } catch {
    return { ok: false, rateLimited: false, message: NETWORK_MESSAGE };
  }

  const body = (await response.json().catch(() => null)) as
    | ({ captions?: unknown; captionToken?: unknown } & ApiErrorBody)
    | null;

  const captions = body?.captions;
  if (
    response.ok &&
    Array.isArray(captions) &&
    captions.every((caption): caption is string => typeof caption === "string") &&
    typeof body?.captionToken === "string"
  ) {
    return { ok: true, captions, captionToken: body.captionToken };
  }

  return commonFailure(response, body);
}

type MemeRequestResult = ({ ok: true; image: string; caption: string } | Failure) & {
  quota: ImageQuota | null;
};

/** Memanggil API gambar. Tidak pernah melempar error. */
async function requestMeme(captionToken: string, captionIndex: number): Promise<MemeRequestResult> {
  let response: Response;
  try {
    response = await authFetch("/api/cook/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captionToken, captionIndex }),
    });
  } catch {
    return { ok: false, rateLimited: false, message: NETWORK_MESSAGE, quota: null };
  }

  const body = (await response.json().catch(() => null)) as
    | ({ image?: unknown; caption?: unknown } & ApiErrorBody)
    | null;
  const quota = isImageQuota(body?.quota) ? body.quota : null;

  if (
    response.ok &&
    typeof body?.image === "string" &&
    body.image.startsWith("data:image/") &&
    typeof body.caption === "string"
  ) {
    return { ok: true, image: body.image, caption: body.caption, quota };
  }

  if (body?.code === "daily_limit") {
    return {
      ok: false,
      rateLimited: false,
      quota,
      message: `You've cooked ${quota?.limit ?? IMAGE_DAILY_LIMIT} memes today. Come back ${resetPhrase(body.resetsAt)}.`,
    };
  }

  if (body?.code === "quota_exhausted") {
    return {
      ok: false,
      rateLimited: false,
      quota,
      message: `The oven is out of gas for today. Image cooking is back ${resetPhrase(body.resetsAt)}.`,
    };
  }

  return { ...commonFailure(response, body), quota };
}
