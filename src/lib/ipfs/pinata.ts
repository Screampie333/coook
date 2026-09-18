import "server-only";

import { LAUNCH } from "@/config/launch";
import { LaunchError } from "@/lib/launch/types";

/**
 * Upload gambar dan metadata koin ke IPFS lewat Pinata.
 * Docs: https://docs.pinata.cloud/api-reference/endpoint/upload-a-file
 *
 * Kenapa perlu: pump.fun tidak lagi menerima upload metadata langsung
 * (endpoint lama pump.fun/api/ipfs sudah tidak didukung), jadi gambar dan
 * metadata JSON harus kita taruh sendiri di IPFS lalu alamatnya dikirim
 * saat membuat koin.
 *
 * IPFS bersifat permanen dan publik. Apa pun yang di-upload di sini tidak bisa
 * ditarik kembali, jadi pastikan isinya sudah lolos moderasi lebih dulu.
 */

const UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";
const TIMEOUT_MS = 30_000;

/** Gambar meme kita sekitar 100–300 KB. Batas ini cuma penjaga supaya tidak ada yang keliru. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

type PinataUploadResponse = {
  data?: { cid?: unknown; id?: unknown; size?: unknown };
  error?: unknown;
};

export type UploadedFile = {
  /** Alamat isi file di IPFS. */
  cid: string;
  /** Alamat lengkap yang bisa dibuka di browser. */
  url: string;
};

function getJwt() {
  const jwt = process.env.PINATA_JWT?.trim();
  if (!jwt) {
    throw new LaunchError("config", "PINATA_JWT is missing.");
  }
  return jwt;
}

/** true kalau Pinata sudah diatur. Dipakai untuk memberi pesan yang jelas lebih awal. */
export function isIpfsConfigured() {
  return Boolean(process.env.PINATA_JWT?.trim());
}

export function ipfsUrl(cid: string) {
  return `${LAUNCH.ipfsGateway}${cid}`;
}

async function uploadFile(data: Uint8Array, filename: string, contentType: string): Promise<UploadedFile> {
  if (data.byteLength === 0) {
    throw new LaunchError("provider_error", "Tried to upload an empty file to IPFS.");
  }
  if (data.byteLength > MAX_FILE_BYTES) {
    throw new LaunchError("provider_error", `File is too big for IPFS upload (${data.byteLength} bytes).`);
  }

  const form = new FormData();
  form.append("file", new Blob([data as unknown as BlobPart], { type: contentType }), filename);
  // "public" = bisa dibaca siapa saja lewat gateway IPFS. Wajib untuk koin pump.fun.
  form.append("network", "public");
  form.append("name", filename);

  let response: Response;
  try {
    response = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${getJwt()}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw toNetworkError(error);
  }

  let body: PinataUploadResponse | null = null;
  try {
    body = (await response.json()) as PinataUploadResponse;
  } catch (error) {
    if (isTimeout(error)) throw toNetworkError(error);
    // Bukan JSON. Ditangani di bawah lewat status HTTP.
  }

  if (!response.ok) {
    throw toHttpError(response, body);
  }

  const cid = body?.data?.cid;
  if (typeof cid !== "string" || cid.length === 0) {
    throw new LaunchError("bad_output", "Pinata did not return an IPFS address for the upload.");
  }

  return { cid, url: ipfsUrl(cid) };
}

export type CoinMetadataInput = {
  /** Gambar koin yang sudah jadi (sudah ada caption-nya kalau user memilih caption). */
  image: { data: Uint8Array; mimeType: "image/jpeg" | "image/png" };
  name: string;
  /** Ticker tanpa tanda $. */
  ticker: string;
  description: string;
  /** Nama file, biasanya id meme. Hanya untuk memudahkan melihat isi akun Pinata. */
  slug: string;
};

export type CoinMetadata = {
  /** Alamat metadata JSON. Ini yang dikirim saat membuat koin. */
  metadataUri: string;
  metadataCid: string;
  imageUrl: string;
  imageCid: string;
};

/**
 * Upload gambar dulu, lalu metadata JSON yang menunjuk ke gambar itu.
 * Bentuk JSON-nya mengikuti contoh resmi PumpPortal.
 */
export async function uploadCoinMetadata(input: CoinMetadataInput): Promise<CoinMetadata> {
  const extension = input.image.mimeType === "image/png" ? "png" : "jpg";
  const image = await uploadFile(input.image.data, `${input.slug}.${extension}`, input.image.mimeType);

  const metadata = {
    name: input.name,
    symbol: input.ticker,
    description: input.description,
    image: image.url,
    showName: true,
    createdOn: LAUNCH.websiteUrl,
    website: LAUNCH.websiteUrl,
  };

  const json = new TextEncoder().encode(JSON.stringify(metadata));
  const uploaded = await uploadFile(json, `${input.slug}.json`, "application/json");

  if (uploaded.url.length > LAUNCH.metadataUriMaxLength) {
    throw new LaunchError("bad_output", "The IPFS address is too long to store on Solana.");
  }

  return {
    metadataUri: uploaded.url,
    metadataCid: uploaded.cid,
    imageUrl: image.url,
    imageCid: image.cid,
  };
}

function isTimeout(error: unknown) {
  return (error as { name?: unknown } | null)?.name === "TimeoutError";
}

function toNetworkError(error: unknown) {
  if (isTimeout(error)) {
    return new LaunchError("timeout", `Pinata did not answer within ${TIMEOUT_MS / 1000}s.`, { cause: error });
  }
  return new LaunchError("unavailable", "Could not reach Pinata (IPFS).", { cause: error });
}

function toHttpError(response: Response, body: PinataUploadResponse | null) {
  const status = response.status;
  let detail = response.statusText || "no details";
  if (body?.error !== undefined) {
    detail = typeof body.error === "string" ? body.error : JSON.stringify(body.error).slice(0, 300);
  }

  if (status === 401 || status === 403) {
    return new LaunchError("config", `Pinata rejected the API key (${status}): ${detail}`);
  }
  if (status === 429) {
    return new LaunchError("rate_limited", `Pinata rate limit reached: ${detail}`);
  }
  if (status >= 500) {
    return new LaunchError("unavailable", `Pinata is unavailable (${status}): ${detail}`);
  }
  return new LaunchError("provider_error", `Pinata upload failed (${status}): ${detail}`);
}
