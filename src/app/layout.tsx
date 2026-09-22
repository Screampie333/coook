import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Shrikhand, Space_Grotesk } from "next/font/google";
import { PrivyProviders } from "@/components/auth/PrivyProviders";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

// Font wordmark di logo Coook. Dipakai juga untuk judul, supaya seluruh situs
// terasa satu keluarga dengan logonya.
const shrikhand = Shrikhand({
  variable: "--font-shrikhand",
  weight: "400",
  subsets: ["latin"],
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
  title: "Coook — Let it coook.",
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
