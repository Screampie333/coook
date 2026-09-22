import Image from "next/image";
import Link from "next/link";

type BrandProps = {
  href?: string;
  onClick?: () => void;
};

/**
 * Logo Coook: Madre si maskot saja, tanpa wordmark.
 *
 * Wordmark sengaja tidak dipakai di sini karena nama "coook" sudah muncul
 * di judul halaman dan tab. Versi lengkap (maskot + wordmark) ada di
 * public/images/coook-logo.png kalau suatu saat dibutuhkan.
 *
 * Gambarnya sudah dipotong latar (transparan), jadi menempel rapi di atas
 * warna apa pun. File asli dari desainer ada di folder yang sama.
 */
export function Brand({ href, onClick }: BrandProps) {
  const logo = (
    <Image
      src="/images/coook-mark.png"
      alt="Coook"
      width={540}
      height={777}
      priority
      className="h-10 w-auto"
    />
  );

  if (!href) return logo;

  return (
    <Link href={href} onClick={onClick} aria-label="Coook home" className="flex items-center">
      {logo}
    </Link>
  );
}
