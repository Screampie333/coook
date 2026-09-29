"use client";

import { PrivyProvider, type PrivyClientConfig } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createContext, useContext } from "react";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

// Nama-nama config di bawah dicek dari tipe PrivyClientConfig di @privy-io/react-auth v3.
const privyConfig: PrivyClientConfig = {
  // Hanya login dengan wallet: tanpa email, SMS, atau sosial.
  loginMethods: ["wallet"],
  appearance: {
    theme: "dark",
    accentColor: "#FF6B1A",
    walletChainType: "solana-only",
    walletList: ["phantom", "solflare", "backpack"],
    // Hanya ada login wallet, jadi Privy mewajibkan ini true (kalau tidak, muncul peringatan di console).
    showWalletLoginFirst: true,
    landingHeader: "Connect to Kuk",
  },
  externalWallets: {
    solana: { connectors: toSolanaWalletConnectors() },
  },
  // Tidak membuat embedded wallet. User selalu pakai wallet sendiri.
  embeddedWallets: {
    ethereum: { createOnLogin: "off" },
    solana: { createOnLogin: "off" },
  },
};

/** true kalau NEXT_PUBLIC_PRIVY_APP_ID terisi dan PrivyProvider aktif. */
const PrivyEnabledContext = createContext(false);

export function usePrivyEnabled() {
  return useContext(PrivyEnabledContext);
}

export function PrivyProviders({ children }: { children: React.ReactNode }) {
  // Tanpa App ID, aplikasi tetap jalan. Tombol Connect akan menampilkan pesan error.
  if (!PRIVY_APP_ID) {
    return <PrivyEnabledContext.Provider value={false}>{children}</PrivyEnabledContext.Provider>;
  }

  return (
    <PrivyEnabledContext.Provider value={true}>
      <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
        {children}
      </PrivyProvider>
    </PrivyEnabledContext.Provider>
  );
}
