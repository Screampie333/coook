import { CookingPot } from "lucide-react";
import type { Metadata } from "next";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { SessionCheck } from "@/components/auth/SessionCheck";
import { Card, CardEmpty } from "@/components/ui/Card";
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
        lede="Every meme you've cooked, in one place. Connect a wallet to see yours."
      />

      <Block>
        <SectionTitle title="Your memes" sub="Saved memes will show up here." />
        <RequireLogin>
          <Card icon={CookingPot} title="Your memes" right={<span className="font-mono">0</span>}>
            <CardEmpty>The pot is empty.</CardEmpty>
          </Card>
          <SessionCheck />
        </RequireLogin>
      </Block>
    </>
  );
}
