/**
 * Tipe lore yang boleh dipakai di browser (hanya info untuk dropdown).
 * Isi lore lengkap hanya dibaca server, lihat src/lib/lore/index.ts.
 */
export type LoreOption = {
  id: string;
  name: string;
  ticker: string;
  mascotName: string;
};
