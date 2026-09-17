"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { Flame, Loader2, Sparkles, Wallet } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { authFetch } from "@/components/auth/hooks";
import { usePrivyEnabled } from "@/components/auth/PrivyProviders";
import { Card } from "@/components/ui/Card";
import { CAPTION_COUNT, IDEA_MAX_LENGTH, normalizeIdea } from "@/lib/cook/limits";
import { CaptionList } from "./CaptionList";

type AuthState =
  | { status: "unavailable" }
  | { status: "loading" }
  | { status: "signed_out"; login: () => void }
  | { status: "signed_in" };

/** Kotak ide + tombol Cook di halaman "/". */
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

function CookPanel({ auth }: { auth: AuthState }) {
  const [idea, setIdea] = useState("");
  const [cooking, setCooking] = useState(false);
  const [captions, setCaptions] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const inputId = useId();

  // Hitung mundur detik setelah rate limit.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const signedIn = auth.status === "signed_in";
  const hasIdea = normalizeIdea(idea).length > 0;
  const canCook = signedIn && hasIdea && !cooking && cooldown === 0;

  async function cook() {
    if (!canCook) return;

    setCooking(true);
    setError(null);
    setCaptions(null);
    try {
      const result = await requestCaptions(normalizeIdea(idea));
      if (result.ok) {
        setCaptions(result.captions);
      } else {
        setError(result.message);
        if (result.rateLimited) {
          const wait = result.retryAfterSeconds ?? DEFAULT_COOLDOWN_SECONDS;
          setCooldown(Math.min(MAX_COOLDOWN_SECONDS, Math.max(1, wait)));
        }
      }
    } finally {
      setCooking(false);
    }
  }

  const length = idea.length;
  const counterColor =
    length >= IDEA_MAX_LENGTH ? "text-warn" : length >= IDEA_MAX_LENGTH - 20 ? "text-accent" : "text-dim";

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
          <label
            htmlFor={inputId}
            className="text-[10px] font-bold tracking-[0.12em] text-dim uppercase"
          >
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
            <CookButton
              auth={auth}
              cooking={cooking}
              cooldown={cooldown}
              disabled={signedIn && !canCook}
            />
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

      {(cooking || captions) && <CaptionList captions={captions} cooking={cooking} />}
    </>
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
  const className =
    "inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:opacity-60 sm:w-auto cursor-pointer";

  if (auth.status === "signed_out") {
    return (
      <button type="button" onClick={auth.login} className={className}>
        <Wallet className="size-4" />
        <span>Connect to cook</span>
      </button>
    );
  }

  if (auth.status !== "signed_in") {
    return (
      <button type="button" disabled className={className}>
        {auth.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Flame className="size-4" />}
        <span>Cook</span>
      </button>
    );
  }

  return (
    <button type="submit" disabled={disabled} aria-busy={cooking} className={className}>
      {cooking ? <Loader2 className="size-4 animate-spin" /> : <Flame className="size-4" />}
      <span>{cooking ? "Cooking…" : cooldown > 0 ? `Wait ${cooldown}s` : "Cook"}</span>
    </button>
  );
}

type CaptionsResult =
  | { ok: true; captions: string[] }
  | { ok: false; message: string; rateLimited: boolean; retryAfterSeconds?: number };

/** Memanggil API. Tidak pernah melempar error; semua kegagalan jadi pesan yang jelas. */
async function requestCaptions(idea: string): Promise<CaptionsResult> {
  let response: Response;
  try {
    response = await authFetch("/api/cook/captions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });
  } catch {
    return {
      ok: false,
      rateLimited: false,
      message: "Couldn't reach the kitchen. Check your connection and try again.",
    };
  }

  const body = (await response.json().catch(() => null)) as {
    captions?: unknown;
    error?: unknown;
    retryAfterSeconds?: unknown;
  } | null;

  const captions = body?.captions;
  if (
    response.ok &&
    Array.isArray(captions) &&
    captions.every((caption): caption is string => typeof caption === "string")
  ) {
    return { ok: true, captions };
  }

  const serverMessage = typeof body?.error === "string" ? body.error : null;

  if (response.status === 401) {
    return { ok: false, rateLimited: false, message: "Your session expired. Connect your wallet again." };
  }

  if (response.status === 429) {
    const retryAfter = typeof body?.retryAfterSeconds === "number" ? body.retryAfterSeconds : undefined;
    const message =
      retryAfter && retryAfter > MAX_COOLDOWN_SECONDS
        ? `The kitchen is packed right now. Try again in about ${Math.ceil(retryAfter / 60)} min.`
        : (serverMessage ?? "The kitchen is packed right now. Try again in a moment.");
    return { ok: false, rateLimited: true, retryAfterSeconds: retryAfter, message };
  }

  return {
    ok: false,
    rateLimited: false,
    message: serverMessage ?? "Something went wrong. Try again.",
  };
}
