import { drawCaption, MEME_FONT_FAMILY, MEME_FONT_URL } from "@/lib/cook/caption-layout";

/**
 * Menempel caption ke gambar DI BROWSER, untuk live preview dan download.
 * Hanya boleh dipanggil dari kode browser (butuh document, canvas, dan FontFace).
 */

const JPEG_QUALITY = 0.9;
/** Hasil render yang disimpan per gambar (caption AI + beberapa ketikan terakhir). */
const MAX_CACHED_RENDERS = 12;

let fontLoading: Promise<void> | null = null;

/** Memuat font meme sekali saja. Kalau gagal, percobaan berikutnya akan memuat ulang. */
function loadMemeFont() {
  if (!fontLoading) {
    const face = new FontFace(MEME_FONT_FAMILY, `url(${MEME_FONT_URL})`);
    fontLoading = face.load().then(
      (loaded) => {
        document.fonts.add(loaded);
      },
      (error: unknown) => {
        fontLoading = null;
        throw error;
      },
    );
  }
  return fontLoading;
}

function loadPicture(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the picture."));
    image.src = src;
  });
}

type PictureCache = {
  picture: string;
  image: Promise<HTMLImageElement>;
  renders: Map<string, Promise<string>>;
};

let cache: PictureCache | null = null;

function cacheFor(picture: string) {
  if (cache?.picture !== picture) {
    cache = { picture, image: loadPicture(picture), renders: new Map() };
  }
  return cache;
}

/**
 * @param picture data URL gambar tanpa caption
 * @param caption teks caption (Enter = pisah atas/bawah)
 * @returns data URL JPEG dengan caption
 */
export function renderMeme(picture: string, caption: string): Promise<string> {
  const entry = cacheFor(picture);
  const cached = entry.renders.get(caption);
  if (cached) return cached;

  const render = (async () => {
    const [image] = await Promise.all([entry.image, loadMemeFont()]);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported in this browser.");

    ctx.drawImage(image, 0, 0);
    drawCaption(ctx, canvas.width, canvas.height, caption);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  })();

  entry.renders.set(caption, render);
  render.catch(() => entry.renders.delete(caption));

  // Batasi memori: buang hasil render paling lama.
  if (entry.renders.size > MAX_CACHED_RENDERS) {
    const oldest = entry.renders.keys().next().value;
    if (oldest !== undefined) entry.renders.delete(oldest);
  }
  return render;
}
