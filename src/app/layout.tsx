import type { Metadata, Viewport } from "next";
import { Bungee, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const bungee = Bungee({
  variable: "--font-bungee",
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
      className={`${bungee.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
