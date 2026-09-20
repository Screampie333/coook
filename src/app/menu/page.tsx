import { UtensilsCrossed } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MemeGridCard } from "@/components/cook/MemeGridCard";
import { Card, CardEmpty } from "@/components/ui/Card";
import { Block, Hero, Highlight } from "@/components/ui/Hero";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { listRecentMemes, MEMES_PAGE_SIZE } from "@/lib/db/memes";
import { isDatabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Menu — Coook",
};

type MenuSearchParams = { before?: string };

export default async function MenuPage({ searchParams }: { searchParams: Promise<MenuSearchParams> }) {
  const params = await searchParams;
  const memes = isDatabaseConfigured() ? await listRecentMemes({ before: params.before }) : [];
  const olderThan = memes.length === MEMES_PAGE_SIZE ? memes[memes.length - 1]?.createdAt : null;

  return (
    <>
      <Hero
        title={
          <>
            Today&apos;s <Highlight>menu</Highlight>.
          </>
        }
        lede="Everything the kitchen has served lately. Freshest first."
      />

      <Block>
        <SectionTitle title="Fresh from the kitchen" sub="Every meme the kitchen has served, newest first." />

        {memes.length === 0 ? (
          <Card icon={UtensilsCrossed} title="Nothing served yet">
            <CardEmpty>
              {params.before
                ? "That's the whole menu."
                : "No memes here yet. Cook the first one on the Cook page."}
            </CardEmpty>
          </Card>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {memes.map((meme) => (
              <MemeGridCard key={meme.id} meme={meme} />
            ))}
          </div>
        )}

        {(olderThan || params.before) && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {params.before && (
              <Link
                href="/menu"
                className="rounded-full border border-line px-5 py-2.5 text-sm font-bold text-ink hover:border-line-hover"
              >
                Newest
              </Link>
            )}
            {olderThan && (
              <Link
                href={`/menu?${new URLSearchParams({ before: olderThan }).toString()}`}
                className="rounded-full border border-line px-5 py-2.5 text-sm font-bold text-ink hover:border-line-hover"
              >
                Older memes
              </Link>
            )}
          </div>
        )}
      </Block>
    </>
  );
}
