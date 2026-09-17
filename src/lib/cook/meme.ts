import "server-only";

import { generateImage } from "@/lib/ai";
import { addCaptionToImage } from "./meme-overlay";
import { buildImagePrompt, describeScene } from "./scene";

/**
 * Alur membuat meme:
 * 1. AI teks menulis adegan dari ide + caption (tanpa tulisan di gambar).
 * 2. AI gambar menggambar adegan itu.
 * 3. Kode menempel caption di atas gambar.
 *
 * @returns JPEG meme yang sudah ada caption-nya.
 */
export async function cookMemeImage(input: { idea: string; caption: string }): Promise<Buffer> {
  const started = Date.now();

  const scene = await describeScene(input);
  const afterScene = Date.now();

  const image = await generateImage({ prompt: buildImagePrompt(scene) });
  const afterImage = Date.now();

  const meme = await addCaptionToImage(image.data, input.caption);

  console.info(
    `[cook/meme] ${image.provider}/${image.model}: scene ${afterScene - started}ms, ` +
      `image ${afterImage - afterScene}ms, caption ${Date.now() - afterImage}ms, ${Math.round(meme.length / 1024)} KB`,
  );
  return meme;
}
