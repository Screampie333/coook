import { CookForm } from "@/components/cook/CookForm";
import { Block, Hero, Highlight } from "@/components/ui/Hero";
import { SectionTitle } from "@/components/ui/SectionTitle";

export default function CookPage() {
  return (
    <>
      <Hero
        title={
          <>
            Let it <Highlight>kuk</Highlight>.
          </>
        }
        lede="Drop in an idea, hit Cook, and get a meme back. Like it? Serve it straight to pump.fun."
      />

      <Block>
        <SectionTitle
          title="Kitchen counter"
          sub="Drop an idea, get one picture and three degen captions. Copy the one that slaps."
        />
        <CookForm />
      </Block>
    </>
  );
}
