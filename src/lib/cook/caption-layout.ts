/**
 * Tata letak caption meme klasik: huruf kapital tebal, isi putih, outline hitam,
 * di bagian atas dan/atau bawah gambar.
 *
 * File ini tidak bergantung pada browser atau server: cukup diberi "context" canvas 2D.
 * Sekarang dipakai di browser (live preview + download). Nanti fitur Serve bisa memakai
 * kode yang sama di server, jadi hasilnya tetap persis sama.
 */

/** Nama font untuk canvas. File-nya: public/fonts/Anton-Regular.ttf (SIL Open Font License). */
export const MEME_FONT_FAMILY = "Kuk Meme";
export const MEME_FONT_URL = "/fonts/Anton-Regular.ttf";

/** Bagian canvas 2D yang dibutuhkan untuk menggambar caption. */
export type CaptionCanvasContext = Pick<
  CanvasRenderingContext2D,
  | "font"
  | "textAlign"
  | "textBaseline"
  | "lineJoin"
  | "miterLimit"
  | "lineWidth"
  | "strokeStyle"
  | "fillStyle"
  | "measureText"
  | "strokeText"
  | "fillText"
>;

/** Caption dengan kata sebanyak ini atau kurang hanya ditaruh di bawah. */
const SHORT_CAPTION_WORDS = 4;

// Ukuran relatif terhadap lebar/tinggi gambar, supaya hasilnya sama di ukuran berapa pun.
const SIDE_PADDING = 0.04;
const EDGE_MARGIN = 0.035;
const MAX_FONT_SIZE = 0.11;
const MIN_FONT_SIZE = 0.05;
const MAX_LINES_PER_BLOCK = 2;
const STROKE_WIDTH = 0.14; // relatif terhadap ukuran huruf
const LINE_ADVANCE = 1.25; // relatif terhadap tinggi huruf kapital

/**
 * Menyiapkan teks untuk digambar: tanda kutip/strip khusus jadi versi biasa,
 * emoji dibuang (font tidak punya emoji), spasi dirapikan, lalu dijadikan huruf kapital.
 */
export function prepareCaptionText(caption: string) {
  return caption
    .normalize("NFC")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/\s*[–—―]\s*/g, " - ") // en/em dash = jeda antar kata
    .replace(/[‐‑‒−]/g, "-") // tanda hubung di dalam kata
    .replace(/…/g, "...")
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}‍︎️⃣\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Membagi teks (yang sudah disiapkan) jadi bagian atas dan bawah secara otomatis.
 * Titik potong: tanda baca yang dekat dengan tengah, atau spasi yang paling dekat dengan tengah.
 */
export function splitCaption(text: string): { top: string; bottom: string } {
  const words = text.split(" ").filter(Boolean);
  if (words.length <= SHORT_CAPTION_WORDS) return { top: "", bottom: words.join(" ") };

  const total = words.join(" ").length;
  let bestIndex = -1;
  let bestScore = Infinity;
  let topLength = -1;

  // Potong setelah kata ke-i. Setiap bagian minimal 2 kata.
  for (let i = 0; i < words.length - 1; i++) {
    topLength += words[i].length + 1;
    if (i + 1 < 2 || words.length - (i + 1) < 2) continue;

    const distanceFromMiddle = Math.abs(topLength / total - 0.5);
    const naturalBreak = /[.,;:!?]$/.test(words[i]) || words[i + 1] === "-";
    const score = distanceFromMiddle - (naturalBreak ? 0.2 : 0);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const top = words
    .slice(0, bestIndex + 1)
    .join(" ")
    .replace(/[\s,;:-]+$/, "");
  const bottom = words
    .slice(bestIndex + 1)
    .join(" ")
    .replace(/^[\s-]+/, "");
  return { top, bottom };
}

/**
 * Teks atas dan bawah dari sebuah caption.
 * - Ada baris baru (Enter): baris pertama di atas, sisanya di bawah.
 * - Tanpa baris baru: dibagi otomatis (lihat splitCaption).
 */
export function captionBlocks(caption: string): { top: string; bottom: string } {
  const newline = caption.search(/\r?\n/);
  if (newline >= 0) {
    return {
      top: prepareCaptionText(caption.slice(0, newline)),
      bottom: prepareCaptionText(caption.slice(newline + 1)),
    };
  }
  return splitCaption(prepareCaptionText(caption));
}

/** true kalau caption punya teks yang bisa digambar (bukan kosong/emoji saja). */
export function hasDrawableText(caption: string) {
  const { top, bottom } = captionBlocks(caption);
  return top.length > 0 || bottom.length > 0;
}

/** Membungkus teks per baris. null = ada kata yang terlalu lebar di ukuran huruf ini. */
function wrapText(ctx: CaptionCanvasContext, text: string, maxWidth: number, breakLongWords: boolean) {
  const lines: string[] = [];
  let line = "";

  const fits = (value: string) => ctx.measureText(value).width <= maxWidth;

  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (fits(candidate)) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = "";

    if (fits(word)) {
      line = word;
    } else if (breakLongWords) {
      // Kata tanpa spasi yang sangat panjang: potong per huruf.
      for (const char of word) {
        if (line && !fits(line + char)) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    } else {
      return null;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function setFont(ctx: CaptionCanvasContext, size: number) {
  ctx.font = `${size}px "${MEME_FONT_FAMILY}"`;
}

/** Mencari ukuran huruf terbesar yang membuat semua blok muat (maks 2 baris per blok). */
function layoutBlocks(ctx: CaptionCanvasContext, blocks: string[], width: number) {
  const maxSize = Math.round(width * MAX_FONT_SIZE);
  const minSize = Math.round(width * MIN_FONT_SIZE);

  for (let size = maxSize; size >= minSize; size -= 2) {
    setFont(ctx, size);
    // Outline menambah lebar di kiri dan kanan huruf.
    const maxWidth = width * (1 - 2 * SIDE_PADDING) - size * STROKE_WIDTH;
    const wrapped = blocks.map((block) => wrapText(ctx, block, maxWidth, false));
    if (wrapped.every((lines) => lines !== null && lines.length <= MAX_LINES_PER_BLOCK)) {
      return { size, lines: wrapped as string[][] };
    }
  }

  // Tetap tidak muat: pakai ukuran terkecil dan izinkan baris tambahan.
  setFont(ctx, minSize);
  const maxWidth = width * (1 - 2 * SIDE_PADDING) - minSize * STROKE_WIDTH;
  return {
    size: minSize,
    lines: blocks.map((block) => wrapText(ctx, block, maxWidth, true) ?? [block]),
  };
}

/**
 * Menggambar caption di atas canvas yang SUDAH berisi gambar.
 * Font MEME_FONT_FAMILY harus sudah dimuat sebelum fungsi ini dipanggil.
 */
export function drawCaption(ctx: CaptionCanvasContext, width: number, height: number, caption: string) {
  const { top, bottom } = captionBlocks(caption);
  const blocks = [top, bottom].filter(Boolean);
  if (blocks.length === 0) return;

  const { size, lines } = layoutBlocks(ctx, blocks, width);
  setFont(ctx, size);

  const capHeight = ctx.measureText("H").actualBoundingBoxAscent;
  const advance = capHeight * LINE_ADVANCE;
  const margin = height * EDGE_MARGIN + size * STROKE_WIDTH;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = size * STROKE_WIDTH;
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#ffffff";

  const drawLine = (text: string, baseline: number) => {
    ctx.strokeText(text, width / 2, baseline);
    ctx.fillText(text, width / 2, baseline);
  };

  const topLines = top ? lines[0] : [];
  const bottomLines = bottom ? lines[lines.length - 1] : [];

  topLines.forEach((text, index) => drawLine(text, margin + capHeight + index * advance));
  bottomLines.forEach((text, index) => drawLine(text, height - margin - (bottomLines.length - 1 - index) * advance));
}
