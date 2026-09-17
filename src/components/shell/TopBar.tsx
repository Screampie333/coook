import { Menu } from "lucide-react";
import { ConnectButton } from "@/components/auth/ConnectButton";
import { Brand } from "@/components/ui/Brand";

type TopBarProps = {
  open: boolean;
  onOpen: () => void;
};

/** Bar atas yang hanya muncul di mobile: brand, tombol Connect, dan hamburger. */
export function TopBar({ open, onOpen }: TopBarProps) {
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line bg-bg/93 px-3.5 py-2.5 backdrop-blur-md shell:hidden">
      <Brand href="/" />
      <div className="flex items-center gap-2">
        <ConnectButton variant="compact" />
        <button
          type="button"
          onClick={onOpen}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="sidebar"
          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-[9px] border border-line bg-panel text-ink"
        >
          <Menu className="size-4.5" />
        </button>
      </div>
    </div>
  );
}
