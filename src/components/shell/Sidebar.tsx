import { BookOpen, ChefHat, CookingPot, X } from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { ContractButton } from "./ContractButton";
import { NavLink } from "./NavLink";
import { WalletSlot } from "./WalletSlot";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Sidebar kiri. Di desktop selalu tampil, di mobile jadi drawer
 * yang bergeser masuk dari kiri saat `open` bernilai true.
 */
export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <aside
      id="sidebar"
      className={`fixed inset-y-0 left-0 z-50 flex w-sidebar flex-col border-r border-line bg-sidebar transition-transform duration-200 ease-out motion-reduce:transition-none shell:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-4.5">
        <Brand href="/" onClick={onClose} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-[9px] border border-line bg-panel text-ink shell:hidden"
        >
          <X className="size-4.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavGroup label="Kitchen">
          <nav className="flex flex-col gap-0.5">
            <NavLink href="/" icon={ChefHat} label="Cook" onNavigate={onClose} />
            <NavLink href="/kitchen" icon={CookingPot} label="My Kitchen" onNavigate={onClose} />
            <NavLink href="/menu" icon={BookOpen} label="Menu" onNavigate={onClose} />
          </nav>
        </NavGroup>

        <NavGroup label="Contract">
          <ContractButton />
        </NavGroup>

        <NavGroup label="Wallet">
          <WalletSlot />
        </NavGroup>
      </div>
    </aside>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5.5">
      <h2 className="mb-2 ml-2 text-[10px] font-bold tracking-[0.12em] text-dim uppercase">
        {label}
      </h2>
      {children}
    </div>
  );
}
