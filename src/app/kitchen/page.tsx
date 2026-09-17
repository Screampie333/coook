import type { Metadata } from "next";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { KitchenContent } from "@/components/cook/KitchenContent";
import { Block, Hero, Highlight } from "@/components/ui/Hero";
import { SectionTitle } from "@/components/ui/SectionTitle";

export const metadata: Metadata = {
  title: "My Kitchen — Coook",
};

export default function KitchenPage() {
  return (
    <>
      <Hero
        title={
          <>
            Your <Highlight>kitchen</Highlight>.
          </>
        }
        lede="Every meme you've cooked, and every coin you've served."
      />

      <Block>
        <SectionTitle title="Your memes" sub="Only you can see the ideas behind them." />
        <RequireLogin>
          <KitchenContent />
        </RequireLogin>
      </Block>
    </>
  );
}
