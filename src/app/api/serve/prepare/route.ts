import { NextResponse } from "next/server";
import { z } from "zod";
import { LAUNCH } from "@/config/launch";
import { isModerationConfigured } from "@/lib/ai";
import { errorResponse, launchErrorResponse } from "@/lib/cook/api-errors";
import { CUSTOM_CAPTION_MAX_LENGTH } from "@/lib/cook/limits";
import { hasConfirmedLaunch, insertPendingLaunch } from "@/lib/db/launches";
import { getMemeForOwner } from "@/lib/db/memes";
import { ensureUser } from "@/lib/db/users";
import { isIpfsConfigured } from "@/lib/ipfs/pinata";
import { getLaunchProvider, isRpcConfigured } from "@/lib/launch";
import { assertCoinTextIsAllowed, buildCoin, defaultDescription } from "@/lib/launch/serve";
import { requireUser } from "@/lib/privy-server";
import { isDatabaseConfigured } from "@/lib/supabase/server";

/**
 * POST /api/serve/prepare
 * Body: { "memeId": "...", "name": "...", "ticker": "...", "description": "...", "caption": "..." }
 * Hasil: {
 *   "coin": { "mintAddress": "...", "name": "...", "ticker": "...", "cluster": "mainnet", "isReal": true },
 *   "transaction": "<base64>",   ← sudah ditandatangani mint, tinggal ditandatangani user
 *   "costSol": 0.0102,
 *   "imageUrl": "https://ipfs.io/..."
 * }
 *
 * Yang terjadi di sini: periksa isi → gambar caption → upload ke IPFS → siapkan transaksi
 * → periksa isi transaksinya → simulasikan → catat sebagai percobaan "pending".
 *
 * Tidak ada SOL yang berpindah di langkah ini. Uang baru bergerak setelah user
 * menandatangani di wallet-nya sendiri dan browser memanggil /api/serve/confirm.
 */

// Unduh gambar + gambar caption + 2 upload IPFS + PumpPortal + simulasi RPC.
export const maxDuration = 60;

const bodySchema = z.object({
  memeId: z.uuid("That meme id doesn't look right."),
  name: z
    .string("Give your coin a name.")
    .trim()
    .min(1, "Give your coin a name.")
    .max(LAUNCH.nameMaxLength, `Keep the name under ${LAUNCH.nameMaxLength} characters.`),
  ticker: z
    .string("Give your coin a ticker.")
    .trim()
    .toUpperCase()
    .pipe(
      z
        .string()
        .min(LAUNCH.tickerMinLength, `The ticker needs at least ${LAUNCH.tickerMinLength} characters.`)
        .max(LAUNCH.tickerMaxLength, `Keep the ticker under ${LAUNCH.tickerMaxLength} characters.`)
        .regex(/^[A-Z0-9]+$/, "The ticker can only use letters and numbers."),
    ),
  description: z
    .string()
    .trim()
    .max(LAUNCH.descriptionMaxLength, `Keep the description under ${LAUNCH.descriptionMaxLength} characters.`)
    .optional()
    .default(""),
  /** Caption yang digambar ke gambar koin. Boleh caption AI atau tulisan sendiri. */
  caption: z
    .string()
    .max(CUSTOM_CAPTION_MAX_LENGTH, `Keep the caption under ${CUSTOM_CAPTION_MAX_LENGTH} characters.`)
    .optional()
    .default(""),
});

export async function POST(request: Request) {
  // 1. Wajib login. Wallet diambil dari data Privy yang terverifikasi, bukan dari browser.
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const wallet = auth.user.walletAddress;

  // 2. Validasi input.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_input", "Send the coin details as JSON.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Those coin details don't look right.";
    return errorResponse(400, "invalid_input", message);
  }

  // 3. Semua yang dibutuhkan sudah diatur di server?
  if (!isDatabaseConfigured()) {
    console.error("[api/serve] SUPABASE_URL or SUPABASE_SECRET_KEY is missing.");
    return errorResponse(500, "server_error", "The kitchen isn't set up yet. Try again later.");
  }
  if (!isIpfsConfigured()) {
    console.error("[api/serve] PINATA_JWT is missing.");
    return errorResponse(500, "server_error", "Serving coins isn't set up yet. Try again later.");
  }
  if (!isModerationConfigured()) {
    console.error("[api/serve] The moderation provider has no API key.");
    return errorResponse(500, "server_error", "Serving coins isn't set up yet. Try again later.");
  }

  let provider;
  try {
    provider = getLaunchProvider();
  } catch (error) {
    return launchErrorResponse(error, "api/serve");
  }
  if (!isRpcConfigured(provider.cluster)) {
    console.error("[api/serve] SOLANA_RPC_URL is missing.");
    return errorResponse(500, "server_error", "Serving coins isn't set up yet. Try again later.");
  }

  const text = {
    name: parsed.data.name,
    ticker: parsed.data.ticker,
    caption: parsed.data.caption,
    description: parsed.data.description || defaultDescription(parsed.data),
  };

  try {
    await ensureUser(wallet, auth.user.userId);

    // 4. Meme-nya harus ada DAN milik user ini.
    const meme = await getMemeForOwner(parsed.data.memeId, wallet);
    if (!meme) {
      return errorResponse(404, "not_found", "That meme isn't in your kitchen.");
    }

    // 5. Satu meme hanya boleh jadi satu koin.
    if (await hasConfirmedLaunch(meme.id)) {
      return errorResponse(409, "already_served", "This meme is already a coin.");
    }

    // 6. Periksa isi SEBELUM apa pun diterbitkan. IPFS dan blockchain tidak bisa ditarik kembali.
    await assertCoinTextIsAllowed(text);

    // 7. Gambar caption → upload ke IPFS → siapkan dan periksa transaksinya.
    const { prepared, metadata } = await buildCoin({
      wallet,
      memeId: meme.id,
      imagePath: meme.imagePath,
      text,
    });

    // 8. Catat percobaannya, supaya saat confirm server tidak perlu percaya kiriman browser.
    await insertPendingLaunch({
      mintAddress: prepared.mintAddress,
      memeId: meme.id,
      walletAddress: wallet,
      name: text.name,
      ticker: text.ticker,
      description: text.description,
      caption: text.caption.trim() || null,
      metadataUri: metadata.metadataUri,
      imageCid: metadata.imageCid,
      cluster: prepared.cluster,
    });

    return NextResponse.json(
      {
        coin: {
          mintAddress: prepared.mintAddress,
          name: text.name,
          ticker: text.ticker,
          cluster: prepared.cluster,
          isReal: prepared.isReal,
          // Wallet yang HARUS menandatangani. Browser bisa punya beberapa wallet terhubung,
          // dan hanya yang ini yang tanda tangannya diterima.
          walletAddress: wallet,
        },
        transaction: Buffer.from(prepared.transaction).toString("base64"),
        costSol: prepared.simulation.costSol,
        imageUrl: metadata.imageUrl,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return launchErrorResponse(error, "api/serve/prepare");
  }
}
