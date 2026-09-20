import "server-only";

import { generateImage, type GenerateImageResult } from "@/lib/ai";
import { cookCaptions } from "./captions";
import { buildImagePrompt, describeScene } from "./scene";

/**
 * Alur Cook (berurutan):
 * 1. AI teks menulis adegan dari ide (dan menolak ide yang melanggar aturan).
 * 2. AI gambar menggambar adegan itu, tanpa tulisan.
 * 3. AI teks menulis 3 caption untuk gambar tersebut.
 * Caption ditempel ke gambar di browser (lihat src/lib/cook/caption-layout.ts),
 * karena caption itu opsional dan user juga bisa menulis caption sendiri.
 */

export type CookResult = {
  /** Gambar asli tanpa caption. */
  picture: { data: Buffer; mimeType: GenerateImageResult["mimeType"] };
  /** 3 caption yang ditulis untuk gambar itu. */
  captions: string[];
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

  console.info(
    `[cook/meme] ${picture.provider}/${picture.model}: ` +
      `scene ${afterScene - started}ms, image ${afterImage - afterScene}ms, ` +
      `captions ${Date.now() - afterImage}ms, ${Math.round(picture.data.length / 1024)} KB`,
  );
  return { picture: { data: picture.data, mimeType: picture.mimeType }, captions };
}
