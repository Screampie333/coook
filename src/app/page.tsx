import { Sparkles } from "lucide-react";
import { Card, CardEmpty } from "@/components/ui/Card";
import { Block, Hero, Highlight } from "@/components/ui/Hero";
import { SectionTitle } from "@/components/ui/SectionTitle";

export default function CookPage() {
  return (
    <>
      <Hero
        title={
          <>
            Let it <Highlight>coook</Highlight>.
          </>
        }
        lede="Drop in your coin's vibe, hit Cook, and get an on-brand meme. Like it? Serve it straight to pump.fun."
      />

      <Block>
        <SectionTitle title="Kitchen counter" sub="Your ingredients go here. The stove turns on soon." />
        <Card icon={Sparkles} title="New meme" right="Coming soon">
          <CardEmpty>Nothing on the stove yet.</CardEmpty>
        </Card>
      </Block>
    </>
  );
}
