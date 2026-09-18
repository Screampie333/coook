import "server-only";

import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { join } from "node:path";
import { drawCaption, hasDrawableText, MEME_FONT_FAMILY, type CaptionCanvasContext } from "./caption-layout";

/**
 * Menempel caption ke gambar DI SERVER, memakai tata letak yang sama persis dengan
 * preview di browser (src/lib/cook/caption-layout.ts).
 *
 * Kenapa digambar di server, bukan mengirim gambar jadi dari browser:
 * gambar ini akan di-upload ke IPFS dan jadi gambar koin yang permanen dan publik.
 * Kalau browser yang mengirim gambarnya, siapa pun bisa mengirim gambar apa saja
 * untuk kita terbitkan. Jadi server menggambar sendiri dari gambar yang tersimpan
 * di database kita.
 */

const FONT_PATH = join(process.cwd(), "public", "fonts", "Anton-Regular.ttf");
/** 0–100. Sedikit lebih tinggi dari preview browser karena gambar ini permanen. */
const JPEG_QUALITY = 92;

let fontLoaded = false;

/** Memuat font meme sekali per proses server. */
function ensureFont() {
  if (fontLoaded) return;

  if (!GlobalFonts.has(MEME_FONT_FAMILY) && !GlobalFonts.registerFromPath(FONT_PATH, MEME_FONT_FAMILY)) {
    throw new Error(`Could not load the meme font from ${FONT_PATH}.`);
  }
  fontLoaded = true;
}

export type RenderedImage = {
  data: Buffer;
  mimeType: "image/jpeg";
};

/**
 * @param picture isi file gambar tanpa caption
 * @param caption teks caption. Kosong = gambar dipakai apa adanya (tetap dijadikan JPEG).
 */
export async function renderMemeImage(picture: Uint8Array, caption: string): Promise<RenderedImage> {
  ensureFont();

  const image = await loadImage(Buffer.from(picture));
  if (!image.width || !image.height) {
    throw new Error("The picture could not be read.");
  }

  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);

  if (hasDrawableText(caption)) {
    // Context dari @napi-rs/canvas punya fungsi yang sama dengan canvas browser,
    // hanya tipenya beda, jadi tipe bersamanya dipasang di sini.
    const captionCtx = ctx as unknown as CaptionCanvasContext;

    // Kalau font gagal terpasang, huruf akan diukur dengan font lain dan hasilnya
    // tidak sama dengan preview. Lebih baik berhenti daripada menerbitkan gambar yang salah.
    captionCtx.font = `100px "${MEME_FONT_FAMILY}"`;
    if (!(captionCtx.measureText("H").actualBoundingBoxAscent > 0)) {
      throw new Error("The meme font is not working on this server.");
    }

    drawCaption(captionCtx, canvas.width, canvas.height, caption);
  }

  return { data: canvas.toBuffer("image/jpeg", JPEG_QUALITY), mimeType: "image/jpeg" };
}
