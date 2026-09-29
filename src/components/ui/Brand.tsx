import Image from "next/image";
import Link from "next/link";

type BrandProps = {
  href?: string;
  onClick?: () => void;
};

/**
 * Logo Kuk: maskot Madre + tulisan "kuk".
 *
 * Tulisannya teks biasa (font Shrikhand, sama dengan wordmark di artwork), bukan gambar,
 * supaya tetap tajam di layar apa pun dan terbaca pembaca layar.
 *
 * Catatan ukuran: di lockup asli, tinggi wordmark cuma 0,225x tinggi karakter.
 * Proporsi itu dibuat untuk tampilan besar — di sidebar hasilnya jadi ~9px dan
 * tidak terbaca, jadi tulisannya sengaja dibuat lebih besar dari aslinya.
 * Yang diikuti dari artwork: warna oranye dan posisinya rata tengah terhadap maskot.
 */
export function Brand({ href, onClick }: BrandProps) {
  const logo = (
    <span className="flex items-center gap-2">
      <Image
        src="/images/coook-mark.png"
        // Kosong: namanya sudah dibacakan oleh teks di sebelahnya.
        alt=""
        width={540}
        height={777}
        priority
        className="h-10 w-auto"
      />
      <span className="font-display text-accent text-[25px] leading-none">kuk</span>
    </span>
  );

  if (!href) return logo;

  return (
    <Link href={href} onClick={onClick} aria-label="Kuk home" className="flex items-center">
      {logo}
    </Link>
  );
}
