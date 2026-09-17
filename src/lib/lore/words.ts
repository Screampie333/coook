/**
 * true kalau `phrase` muncul di `text` di AWAL sebuah kata, tanpa peduli huruf besar/kecil.
 * Jadi "rug" cocok dengan "rug", "rugs", "rugged", tapi tidak dengan "drug" atau "shrug".
 */
export function containsWordStart(text: string, phrase: string) {
  const escaped = phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}`, "iu").test(text);
}
