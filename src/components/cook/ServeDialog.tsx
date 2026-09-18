"use client";

import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { ArrowLeft, Check, ExternalLink, Loader2, Rocket, TriangleAlert, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { LAUNCH } from "@/config/launch";
import {
  base64ToBytes,
  bytesToBase64,
  cleanTicker,
  confirmCoin,
  prepareCoin,
  type ConfirmedCoin,
  type PreparedCoin,
} from "./serve-api";

/**
 * Jendela "Serve as coin": isi nama koin → lihat rinciannya → tanda tangan di wallet → koin jadi.
 *
 * User tidak pernah menandatangani sesuatu yang tidak dia lihat: sebelum wallet terbuka,
 * layar ini menampilkan gambar koinnya, nama, ticker, dan biaya pastinya (dari simulasi server).
 */

type ServeDialogProps = {
  memeId: string;
  /** Gambar meme tanpa caption, untuk pratinjau. */
  picture: string;
  /** Caption yang sedang dipilih user. Ini yang akan digambar ke gambar koin. */
  caption: string;
  /** Saran nama koin, misalnya dari lore yang dipakai. */
  suggestedName?: string;
  onClose: () => void;
};

type Step =
  | { kind: "form" }
  | { kind: "preparing" }
  | { kind: "review"; coin: PreparedCoin }
  | { kind: "signing"; coin: PreparedCoin }
  | { kind: "sending"; coin: PreparedCoin }
  | { kind: "done"; coin: ConfirmedCoin };

const buttonBase =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const primaryButton = `${buttonBase} bg-accent text-bg hover:opacity-90`;
const secondaryButton = `${buttonBase} border border-line bg-panel text-ink hover:border-line-hover disabled:hover:border-line`;
const fieldClass =
  "w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-dim focus:border-accent focus:outline-hidden";

export function ServeDialog({ memeId, picture, caption, suggestedName, onClose }: ServeDialogProps) {
  const fieldId = useId();
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();

  const [name, setName] = useState(suggestedName ?? "");
  const [ticker, setTicker] = useState(suggestedName ? cleanTicker(suggestedName).slice(0, 10) : "");
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [error, setError] = useState<string | null>(null);

  const closeRef = useRef<HTMLButtonElement>(null);
  const busy = step.kind === "preparing" || step.kind === "signing" || step.kind === "sending";

  // Esc menutup jendela, kecuali saat ada proses berjalan yang tidak boleh diputus.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  async function startPrepare() {
    setError(null);
    setStep({ kind: "preparing" });

    const result = await prepareCoin({
      memeId,
      name: name.trim(),
      ticker: cleanTicker(ticker),
      description: description.trim(),
      caption,
    });

    if (!result.ok) {
      setError(result.message);
      setStep({ kind: "form" });
      return;
    }
    setStep({ kind: "review", coin: result.data });
  }

  async function signAndSend(coin: PreparedCoin) {
    setError(null);

    // Transaksi ini hanya sah kalau ditandatangani wallet yang server sebutkan.
    // Kalau user menghubungkan beberapa wallet, yang lain tidak akan diterima.
    const wallet = wallets.find((candidate) => candidate.address === coin.walletAddress);
    if (!wallet) {
      setError(
        coin.walletAddress
          ? "This coin is set up for a different wallet. Switch back to the wallet you logged in with."
          : "No wallet connected. Reconnect your wallet and try again.",
      );
      return;
    }

    setStep({ kind: "signing", coin });
    let signed: Uint8Array;
    try {
      const result = await signTransaction({
        transaction: base64ToBytes(coin.transaction),
        wallet,
        chain: coin.cluster === "devnet" ? "solana:devnet" : "solana:mainnet",
      });
      signed = result.signedTransaction;
    } catch (signError) {
      // Paling sering: user menekan Reject di wallet.
      console.warn("[coook] signing failed:", signError);
      setError("Signature cancelled in your wallet. Nothing was created.");
      setStep({ kind: "review", coin });
      return;
    }

    setStep({ kind: "sending", coin });
    const result = await confirmCoin(coin.mintAddress, bytesToBase64(signed));
    if (!result.ok) {
      setError(result.message);
      setStep({ kind: "review", coin });
      return;
    }
    setStep({ kind: "done", coin: result.data });
  }

  const canSubmit = name.trim().length > 0 && cleanTicker(ticker).length >= LAUNCH.tickerMinLength;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/80 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${fieldId}-title`}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="my-auto w-full max-w-lg rounded-2xl border border-line bg-panel shadow-2xl">
        {/* Judul */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Rocket className="size-4 flex-none text-accent" />
          <h2 id={`${fieldId}-title`} className="min-w-0 flex-1 text-sm font-bold text-ink">
            {step.kind === "done" ? "Your coin is live" : "Serve as coin"}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="inline-flex size-8 flex-none cursor-pointer items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-line-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {step.kind === "form" && (
            <FormStep
              fieldId={fieldId}
              name={name}
              onName={setName}
              ticker={ticker}
              onTicker={setTicker}
              description={description}
              onDescription={setDescription}
              caption={caption}
            />
          )}

          {step.kind === "preparing" && (
            <Waiting title="Getting your coin ready…" detail="Drawing the picture, publishing it, and building the transaction." />
          )}

          {(step.kind === "review" || step.kind === "signing" || step.kind === "sending") && (
            <ReviewStep coin={step.coin} picture={picture} step={step.kind} />
          )}

          {step.kind === "done" && <DoneStep coin={step.coin} />}

          {error && (
            <p role="alert" className="rounded-lg border border-warn/40 bg-warn/5 px-3 py-2 text-[13px] text-warn">
              {error}
            </p>
          )}

          {/* Tombol */}
          <div className="flex flex-col gap-2.5">
            {step.kind === "form" && (
              <button type="button" onClick={() => void startPrepare()} disabled={!canSubmit} className={primaryButton}>
                <Rocket className="size-4" />
                <span>Review your coin</span>
              </button>
            )}

            {step.kind === "review" && (
              <>
                <button type="button" onClick={() => void signAndSend(step.coin)} className={primaryButton}>
                  <Rocket className="size-4" />
                  <span>Sign in your wallet</span>
                </button>
                <button type="button" onClick={() => setStep({ kind: "form" })} className={secondaryButton}>
                  <ArrowLeft className="size-4" />
                  <span>Change the details</span>
                </button>
              </>
            )}

            {step.kind === "done" && (
              <>
                <a
                  href={step.coin.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${primaryButton} w-full`}
                >
                  <ExternalLink className="size-4" />
                  <span>{step.coin.isReal ? "Open on pump.fun" : "Open in explorer"}</span>
                </a>
                <button type="button" onClick={onClose} className={secondaryButton}>
                  <span>Back to your meme</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormStep({
  fieldId,
  name,
  onName,
  ticker,
  onTicker,
  description,
  onDescription,
  caption,
}: {
  fieldId: string;
  name: string;
  onName: (value: string) => void;
  ticker: string;
  onTicker: (value: string) => void;
  description: string;
  onDescription: (value: string) => void;
  caption: string;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[13px] text-muted">
        This turns your meme into a real coin on pump.fun. The picture you see now, caption included, becomes the
        coin&apos;s image.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${fieldId}-name`} className="text-[10px] font-bold tracking-[0.12em] text-dim uppercase">
          Coin name
        </label>
        <input
          id={`${fieldId}-name`}
          value={name}
          onChange={(event) => onName(event.target.value)}
          maxLength={LAUNCH.nameMaxLength}
          placeholder="Chef Coook"
          className={fieldClass}
        />
        <Counter value={name.length} max={LAUNCH.nameMaxLength} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${fieldId}-ticker`} className="text-[10px] font-bold tracking-[0.12em] text-dim uppercase">
          Ticker
        </label>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-dim">$</span>
          <input
            id={`${fieldId}-ticker`}
            value={ticker}
            onChange={(event) => onTicker(cleanTicker(event.target.value))}
            maxLength={LAUNCH.tickerMaxLength}
            placeholder="COOOK"
            className={`${fieldClass} font-mono uppercase`}
          />
        </div>
        <p className="text-[11px] text-dim">
          Letters and numbers only, {LAUNCH.tickerMinLength}–{LAUNCH.tickerMaxLength} characters.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${fieldId}-description`}
          className="text-[10px] font-bold tracking-[0.12em] text-dim uppercase"
        >
          Description <span className="normal-case">(optional)</span>
        </label>
        <textarea
          id={`${fieldId}-description`}
          value={description}
          onChange={(event) => onDescription(event.target.value)}
          maxLength={LAUNCH.descriptionMaxLength}
          rows={3}
          placeholder={caption || "What is this coin about?"}
          className={`${fieldClass} resize-none`}
        />
        <Counter value={description.length} max={LAUNCH.descriptionMaxLength} />
      </div>
    </div>
  );
}

function ReviewStep({ coin, picture, step }: { coin: PreparedCoin; picture: string; step: Step["kind"] }) {
  return (
    <div className="flex flex-col gap-3.5">
      {!coin.isReal && (
        <p className="flex items-start gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-[13px] text-muted">
          <TriangleAlert className="mt-0.5 size-4 flex-none text-accent" />
          <span>
            <strong className="text-ink">Practice mode (devnet).</strong> This creates a test token that has no
            value and is not on pump.fun. Good for checking the flow.
          </span>
        </p>
      )}

      <div className="flex gap-3">
        <div className="relative size-24 flex-none overflow-hidden rounded-xl border border-line bg-panel-2">
          <Image
            src={coin.imageUrl || picture}
            alt="Your coin's picture"
            width={256}
            height={256}
            unoptimized
            className="size-full object-cover"
          />
        </div>
        <dl className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 text-sm">
          <Row label="Name" value={coin.name} />
          <Row label="Ticker" value={`$${coin.ticker}`} mono />
          <Row label="Network" value={coin.isReal ? "Solana mainnet" : "Solana devnet"} />
        </dl>
      </div>

      <div className="rounded-lg border border-line bg-panel-2 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-muted">You&apos;ll pay</span>
          <span className="font-mono text-base font-bold text-ink">{coin.costSol.toFixed(4)} SOL</span>
        </div>
        <p className="mt-1 text-[11px] text-dim">
          Network fee and account rent. Coook takes nothing, and no tokens are bought for you.
        </p>
      </div>

      {step === "signing" && <Waiting title="Waiting for your wallet…" detail="Approve the transaction in your wallet to create the coin." />}
      {step === "sending" && <Waiting title="Creating your coin…" detail="Sending it to Solana and waiting for confirmation. Don't close this window." />}
    </div>
  );
}

function DoneStep({ coin }: { coin: ConfirmedCoin }) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/5 px-3 py-2.5">
        <Check className="size-5 flex-none text-success" />
        <p className="text-[13px] text-ink">
          <strong>{coin.name}</strong> <span className="font-mono text-accent">${coin.ticker}</span> is now live
          {coin.isReal ? " on pump.fun" : " on devnet"}.
        </p>
      </div>

      <dl className="flex flex-col gap-1.5 text-sm">
        <Row label="Coin address" value={coin.mintAddress} mono wrap />
      </dl>

      <a
        href={coin.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted underline-offset-2 hover:text-ink hover:underline"
      >
        <ExternalLink className="size-3.5" />
        <span>See the transaction</span>
      </a>
    </div>
  );
}

function Row({ label, value, mono, wrap }: { label: string; value: string; mono?: boolean; wrap?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-24 flex-none text-[11px] tracking-wide text-dim uppercase">{label}</dt>
      <dd className={`min-w-0 flex-1 text-ink ${mono ? "font-mono text-[13px]" : ""} ${wrap ? "break-all" : "truncate"}`}>
        {value}
      </dd>
    </div>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={`text-right font-mono text-[11px] ${value >= max ? "text-warn" : "text-dim"}`}>
      {value}/{max}
    </span>
  );
}

function Waiting({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-6 text-center" aria-live="polite">
      <Loader2 className="size-5 animate-spin text-accent" />
      <p className="text-sm font-bold text-ink">{title}</p>
      <p className="max-w-[36ch] text-xs text-dim">{detail}</p>
    </div>
  );
}
