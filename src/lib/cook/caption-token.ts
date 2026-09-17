import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CAPTION_COUNT, IDEA_MAX_LENGTH } from "./limits";

/**
 * "Tiket" caption yang ditandatangani server.
 *
 * Saat caption dibuat, server memberi browser sebuah token berisi wallet + ide + 3 caption,
 * ditandatangani dengan COOK_SIGNING_SECRET (HMAC-SHA256). Saat membuat gambar, browser hanya
 * mengirim token + nomor caption. Karena browser tidak tahu secret-nya, isi token tidak bisa
 * diubah, jadi teks yang ditempel di gambar pasti caption buatan Coook untuk wallet itu.
 */

const TOKEN_TTL_SECONDS = 30 * 60;
const MIN_SECRET_LENGTH = 32;

const payloadSchema = z.object({
  v: z.literal(1),
  wallet: z.string().min(1),
  idea: z.string().min(1).max(IDEA_MAX_LENGTH),
  captions: z.array(z.string().min(1)).length(CAPTION_COUNT),
  exp: z.number().int(),
});

export type CaptionTokenPayload = z.infer<typeof payloadSchema>;

export type VerifyCaptionTokenResult =
  | { ok: true; payload: CaptionTokenPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "wrong_wallet" };

function getSecret() {
  const secret = process.env.COOK_SIGNING_SECRET ?? "";
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

/** false kalau COOK_SIGNING_SECRET kosong atau terlalu pendek. Cek ini sebelum memakai AI. */
export function isCaptionTokenConfigured() {
  return getSecret() !== null;
}

function sign(data: string, secret: string) {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createCaptionToken(
  input: { wallet: string; idea: string; captions: string[] },
  now = Date.now(),
) {
  const secret = getSecret();
  if (!secret) throw new Error("COOK_SIGNING_SECRET is missing or shorter than 32 characters.");

  const payload: CaptionTokenPayload = {
    v: 1,
    wallet: input.wallet,
    idea: input.idea,
    captions: input.captions,
    exp: Math.floor(now / 1000) + TOKEN_TTL_SECONDS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

/** Memeriksa tanda tangan, masa berlaku, dan pemilik token. */
export function verifyCaptionToken(token: string, wallet: string, now = Date.now()): VerifyCaptionTokenResult {
  const secret = getSecret();
  if (!secret) throw new Error("COOK_SIGNING_SECRET is missing or shorter than 32 characters.");

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };
  const [data, signature] = parts;

  // Bandingkan tanda tangan dengan waktu konstan supaya tidak bisa ditebak lewat lama proses.
  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: "bad_signature" };
  }

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "malformed" };
  if (parsed.data.exp * 1000 <= now) return { ok: false, reason: "expired" };
  if (parsed.data.wallet !== wallet) return { ok: false, reason: "wrong_wallet" };

  return { ok: true, payload: parsed.data };
}
