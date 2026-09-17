"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLinkProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  onNavigate?: () => void;
};

/** Satu item navigasi. Berwarna oranye kalau halamannya sedang dibuka. */
export function NavLink({ href, icon: Icon, label, onNavigate }: NavLinkProps) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-sm font-medium transition-colors ${
        active ? "bg-accent-soft text-accent" : "text-muted hover:bg-panel hover:text-ink"
      }`}
    >
      <Icon className="size-4.25 flex-none" />
      <span>{label}</span>
    </Link>
  );
}
