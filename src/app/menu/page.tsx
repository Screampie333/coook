import { UtensilsCrossed } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MemeGridCard } from "@/components/cook/MemeGridCard";
import { Card, CardEmpty } from "@/components/ui/Card";
import { Block, Hero, Highlight } from "@/components/ui/Hero";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { listRecentMemes, MEMES_PAGE_SIZE } from "@/lib/db/memes";
import { listLoreOptions } from "@/lib/lore";
import { isDatabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Menu — Coook",
};

type MenuSearchParams = { lore?: string; before?: string };

export default async function MenuPage({ searchParams }: { searchParams: Promise<MenuSearchParams> }) {
  const params = await searchParams;
  const loreFilter = params.lore ?? "all";

  const [lores, memes] = await Promise.all([
    listLoreOptions(),
    isDatabaseConfigured() ? listRecentMemes({ loreId: loreFilter, before: params.before }) : Promise.resolve([]),
  ]);

  const olderThan = memes.length === MEMES_PAGE_SIZE ? memes[memes.length - 1]?.createdAt : null;
  const filters = [
    { id: "all", label: "All" },
    { id: "none", label: "Free memes" },
    ...lores.map((lore) => ({ id: lore.id, label: lore.name })),
  ];

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
        <SectionTitle title="Fresh from the kitchen" sub="Pick a lore to see only its memes." />

        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const active = filter.id === loreFilter;
            return (
              <Link
                key={filter.id}
                href={filter.id === "all" ? "/menu" : `/menu?lore=${filter.id}`}
                aria-current={active ? "page" : undefined}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line text-muted hover:border-line-hover hover:text-ink"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

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
                href={loreFilter === "all" ? "/menu" : `/menu?lore=${loreFilter}`}
                className="rounded-full border border-line px-5 py-2.5 text-sm font-bold text-ink hover:border-line-hover"
              >
                Newest
              </Link>
            )}
            {olderThan && (
              <Link
                href={`/menu?${new URLSearchParams({ ...(loreFilter !== "all" ? { lore: loreFilter } : {}), before: olderThan }).toString()}`}
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
