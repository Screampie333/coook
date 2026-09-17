import { connection } from "next/server";
import { CookForm } from "@/components/cook/CookForm";
import { Block, Hero, Highlight } from "@/components/ui/Hero";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { listLoreOptions } from "@/lib/lore";

export default async function CookPage() {
  // Daftar lore dibaca dari database setiap kali halaman dibuka, bukan saat build,
  // supaya lore baru langsung muncul tanpa deploy ulang.
  await connection();
  const lores = await listLoreOptions();

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
          sub="Drop an idea, get one picture and three degen captions. Copy the one that slaps."
        />
        <CookForm lores={lores} />
      </Block>
    </>
  );
}
