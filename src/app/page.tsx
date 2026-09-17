import { CookForm } from "@/components/cook/CookForm";
import { listLoreOptions } from "@/lib/lore";
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
        <SectionTitle
          title="Kitchen counter"
          sub="Drop an idea, get three degen captions. Copy the one that slaps."
        />
        <CookForm lores={listLoreOptions()} />
      </Block>
    </>
  );
}
