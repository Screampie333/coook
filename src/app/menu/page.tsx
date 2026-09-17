import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardEmpty } from "@/components/ui/Card";
import { Block, Hero, Highlight } from "@/components/ui/Hero";
import { SectionTitle } from "@/components/ui/SectionTitle";

export const metadata: Metadata = {
  title: "Menu — Coook",
};

export default function MenuPage() {
  return (
    <>
      <Hero
        title={
          <>
            Today&apos;s <Highlight>menu</Highlight>.
          </>
        }
        lede="Memes that were served as coins on pump.fun."
      />

      <Block>
        <SectionTitle title="Served coins" sub="Fresh coins from the Coook kitchen will be listed here." />
        <Card icon={BookOpen} title="Served coins" right={<span className="font-mono">0</span>}>
          <CardEmpty>Nothing served yet.</CardEmpty>
        </Card>
      </Block>
    </>
  );
}
