import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, launchErrorResponse, setupErrorResponse } from "@/lib/cook/api-errors";
import { findPendingLaunch, markLaunchConfirmed, markLaunchFailed } from "@/lib/db/launches";
import { accountExists, getLaunchProvider, LaunchError, sendSignedTransaction, waitForTransaction } from "@/lib/launch";
import { coinUrl, explorerTransactionUrl } from "@/lib/launch/links";
import { inspectSignedTransaction } from "@/lib/launch/verify";
import { requireUser } from "@/lib/privy-server";
import { isDatabaseConfigured } from "@/lib/supabase/server";

/**
 * POST /api/serve/confirm
 * Body: { "mintAddress": "...", "transaction": "<base64 yang sudah ditandatangani user>" }
 * Hasil: { "coin": { "mintAddress", "name", "ticker", "cluster", "url" }, "signature": "...", "explorerUrl": "..." }
 *
 * Yang terjadi: periksa lagi isi transaksinya → siarkan ke Solana → tunggu benar-benar masuk
 * → pastikan koinnya ada → catat sebagai selesai.
 *
 * Nama, ticker, dan meme-nya diambil dari catatan "pending" milik server, BUKAN dari browser.
 */

// Menyiarkan transaksi lalu menunggu konfirmasi jaringan.
export const maxDuration = 90;

const bodySchema = z.object({
  mintAddress: z
    .string("That coin address doesn't look right.")
    .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "That coin address doesn't look right."),
  transaction: z.base64("That signed transaction doesn't look right.").max(4000),
});

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const wallet = auth.user.walletAddress;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_input", "Send the signed transaction as JSON.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "That signed transaction doesn't look right.";
    return errorResponse(400, "invalid_input", message);
  }

  if (!isDatabaseConfigured()) {
    return setupErrorResponse("api/serve/confirm", "SUPABASE_URL or SUPABASE_SECRET_KEY", "The kitchen");
  }

  let provider;
  try {
    provider = getLaunchProvider();
  } catch (error) {
    return launchErrorResponse(error, "api/serve/confirm");
  }

  let launchId: string | null = null;
  try {
    // 1. Percobaan ini harus tercatat di server, milik wallet ini, dan masih menunggu.
    const pending = await findPendingLaunch(parsed.data.mintAddress, wallet);
    if (!pending) {
      return errorResponse(404, "not_found", "That coin attempt has expired. Start again from your meme.");
    }
    launchId = pending.id;

    if (pending.cluster !== provider.cluster) {
      return errorResponse(
        409,
        "wrong_network",
        "This attempt was prepared for a different network. Start again from your meme.",
      );
    }

    // 2. Periksa transaksi kiriman browser: isinya harus tetap yang kita buat, dan lengkap tanda tangannya.
    const signed = Buffer.from(parsed.data.transaction, "base64");
    await inspectSignedTransaction(
      new Uint8Array(signed),
      { creator: wallet, mint: pending.mintAddress },
      provider,
    );

    // 3. Kirim ke jaringan dan tunggu sampai benar-benar masuk.
    const signature = await sendSignedTransaction(new Uint8Array(signed), pending.cluster);
    await waitForTransaction(signature, pending.cluster);

    // 4. Pastikan koinnya memang ada, bukan cuma transaksinya lewat.
    if (!(await accountExists(pending.mintAddress, pending.cluster))) {
      throw new LaunchError("rejected", "The transaction went through but the coin wasn't created.");
    }

    await markLaunchConfirmed(pending.id, signature);

    return NextResponse.json(
      {
        coin: {
          mintAddress: pending.mintAddress,
          name: pending.name,
          ticker: pending.ticker,
          cluster: pending.cluster,
          isReal: provider.isReal,
          url: coinUrl(pending.mintAddress, pending.cluster),
        },
        signature,
        explorerUrl: explorerTransactionUrl(signature, pending.cluster),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Percobaan ini tidak bisa dipakai lagi: blockhash-nya sudah lewat atau transaksinya ditolak.
    if (launchId) await markLaunchFailed(launchId);
    return launchErrorResponse(error, "api/serve/confirm");
  }
}
