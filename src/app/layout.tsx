import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { PrivyProviders } from "@/components/auth/PrivyProviders";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

// Font wordmark di logo Kuk. Dipakai juga untuk judul, supaya seluruh situs
// terasa satu keluarga dengan logonya.
//
// Filenya ikut di repo (public/fonts/), bukan diambil dari Google Fonts, jadi
// tidak ada permintaan ke server luar saat halaman dibuka.
const shrikhand = localFont({
  src: "../../public/fonts/shrikhand-latin-400-normal.woff2",
  variable: "--font-shrikhand",
  weight: "400",
  style: "normal",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kuk — Let it kuk.",
  description: "Cook on-brand memes for your pump.fun coin, then serve them as a coin.",
};

export const viewport: Viewport = {
  themeColor: "#0b0809",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${shrikhand.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <PrivyProviders>
          <AppShell>{children}</AppShell>
        </PrivyProviders>
      </body>
    </html>
  );
}
