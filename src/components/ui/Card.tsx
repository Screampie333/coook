import type { LucideIcon } from "lucide-react";

type CardProps = {
  icon: LucideIcon;
  title: string;
  /** Info kecil di kanan header, misalnya jumlah item. */
  right?: React.ReactNode;
  children?: React.ReactNode;
};

/** Kartu dengan header ikon + judul + info kanan. */
export function Card({ icon: Icon, title, right, children }: CardProps) {
  return (
    <div className="mt-5.5 overflow-hidden rounded-card border border-line bg-panel">
      <div className="flex items-center gap-2.25 border-b border-line px-4 py-3 text-[13px] font-bold tracking-[0.02em]">
        <Icon className="size-4 flex-none text-dim" />
        <span>{title}</span>
        {right && <span className="ml-auto text-xs font-normal text-dim">{right}</span>}
      </div>
      {children}
    </div>
  );
}

/** Isi kartu kosong untuk placeholder. */
export function CardEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-4 rounded-[10px] border border-dashed border-line px-4 py-10 text-center text-[13px] text-dim">
      {children}
    </div>
  );
}
