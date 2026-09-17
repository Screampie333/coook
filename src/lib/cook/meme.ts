import "server-only";

import { generateImage } from "@/lib/ai";
import { cookCaptions } from "./captions";
import { addCaptionToImage } from "./meme-overlay";
import { buildImagePrompt, describeScene } from "./scene";

/**
 * Alur Cook (berurutan):
 * 1. AI teks menulis adegan dari ide (dan menolak ide yang melanggar aturan).
 * 2. AI gambar menggambar adegan itu, tanpa tulisan.
 * 3. AI teks menulis 3 caption untuk gambar tersebut.
 * 4. Kode menempel tiap caption ke gambar yang sama → 3 versi meme.
 */

export type CookedMeme = {
  caption: string;
  /** JPEG yang sudah ada caption-nya. */
  image: Buffer;
};

/**
 * @param idea ide yang SUDAH divalidasi dan dirapikan (lihat normalizeIdea).
 * @throws IdeaRejectedError kalau idenya melanggar aturan.
 * @throws AiError kalau salah satu AI gagal (rate limit, kuota habis, timeout, dll.).
 */
export async function cookMeme(idea: string): Promise<CookedMeme[]> {
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
  return memes;
}
