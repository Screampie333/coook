import Image from "next/image";
import Link from "next/link";

type BrandProps = {
  href?: string;
  onClick?: () => void;
};

/**
 * Logo Coook: Madre si maskot + wordmark "coook".
 *
 * Gambarnya sudah dipotong latar (transparan), jadi menempel rapi di atas
 * warna apa pun. Sumbernya ada di public/images/ bersama versi aslinya.
 */
export function Brand({ href, onClick }: BrandProps) {
  const logo = (
    <Image
      src="/images/coook-logo.png"
      alt="Coook"
      width={2427}
      height={864}
      priority
      className="h-8 w-auto"
    />
  );

  if (!href) return logo;

  return (
    <Link href={href} onClick={onClick} aria-label="Coook home" className="flex items-center">
      {logo}
    </Link>
  );
}
