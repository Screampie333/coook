import "server-only";

import { generateImage, type GenerateImageResult } from "@/lib/ai";
import { cookCaptions } from "./captions";
import { addCaptionToImage } from "./meme-overlay";
import { buildImagePrompt, describeScene } from "./scene";

/**
 * Alur Cook (berurutan):
 * 1. AI teks menulis adegan dari ide (dan menolak ide yang melanggar aturan).
 * 2. AI gambar menggambar adegan itu, tanpa tulisan.
 * 3. AI teks menulis 3 caption untuk gambar tersebut.
 * 4. Kode menempel tiap caption ke gambar yang sama → 3 versi meme.
 * Gambar polos (tanpa caption) juga dikembalikan, karena caption itu opsional.
 */

export type CookedMeme = {
  caption: string;
  /** JPEG yang sudah ada caption-nya. */
  image: Buffer;
};

export type CookResult = {
  /** Gambar asli tanpa caption. */
  picture: { data: Buffer; mimeType: GenerateImageResult["mimeType"] };
  /** Gambar yang sama, masing-masing dengan satu caption. */
  memes: CookedMeme[];
};

/**
 * @param idea ide yang SUDAH divalidasi dan dirapikan (lihat normalizeIdea).
 * @throws IdeaRejectedError kalau idenya melanggar aturan.
 * @throws AiError kalau salah satu AI gagal (rate limit, kuota habis, timeout, dll.).
 */
export async function cookMeme(idea: string): Promise<CookResult> {
  const started = Date.now();

  const scene = await describeScene(idea);
  const afterScene = Date.now();

  const picture = await generateImage({ prompt: buildImagePrompt(scene) });
  const afterImage = Date.now();

  const captions = await cookCaptions({ idea, scene });
  const afterCaptions = Date.now();

  const memes = await Promise.all(
    captions.map(async (caption) => ({ caption, image: await addCaptionToImage(picture.data, caption) })),
  );

  console.info(
    `[cook/meme] ${picture.provider}/${picture.model}: scene ${afterScene - started}ms, ` +
      `image ${afterImage - afterScene}ms, captions ${afterCaptions - afterImage}ms, ` +
      `overlay ${Date.now() - afterCaptions}ms`,
  );
  return { picture: { data: picture.data, mimeType: picture.mimeType }, memes };
}
