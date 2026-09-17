import Link from "next/link";

type BrandProps = {
  href?: string;
  onClick?: () => void;
};

/** Logo teks "coook" — tiga huruf o berwarna oranye. */
export function Brand({ href, onClick }: BrandProps) {
  const word = (
    <span className="font-display text-[19px] leading-none tracking-[0.02em]">
      c<span className="text-accent">ooo</span>k
    </span>
  );

  if (!href) return word;

  return (
    <Link href={href} onClick={onClick} aria-label="Coook home" className="flex items-center">
      {word}
    </Link>
  );
}
