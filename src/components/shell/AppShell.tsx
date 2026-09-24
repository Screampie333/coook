"use client";

import { useEffect, useState } from "react";
import { Footer } from "@/components/ui/Footer";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * Kerangka semua halaman: top bar (tombol Connect), sidebar, area utama, footer.
 * Di sini juga state buka/tutup drawer mobile disimpan.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Tombol Esc menutup drawer
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <TopBar open={drawerOpen} onOpen={() => setDrawerOpen(true)} />

      {/* Backdrop gelap di belakang drawer (mobile saja) */}
      <div
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
        className={`fixed inset-0 z-45 bg-black/60 shell:hidden ${drawerOpen ? "block" : "hidden"}`}
      />

      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main className="relative z-1 shell:ml-sidebar">
        {children}
        <Footer />
      </main>
    </>
  );
}
