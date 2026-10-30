"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { SlopWordmark } from "@/components/brand/logo";
import { DramaCard } from "@/components/browse/drama-card";
import {
  GenreTile,
  genreCount,
  genreCover,
} from "@/components/browse/genre-tile";
import { useSlopStore } from "@/store/slop-store";

function ExploreInner() {
  const params = useSearchParams();
  const sort = params.get("sort") ?? "trending";
  const categories = useSlopStore((s) => s.categories);
  const dramas = useSlopStore((s) => s.dramas);

  const published = useMemo(() => {
    const list = dramas.filter((d) => d.status === "published");
    if (sort === "newest") {
      return [...list].sort(
        (a, b) =>
          new Date(b.publishedAt ?? b.createdAt).getTime() -
          new Date(a.publishedAt ?? a.createdAt).getTime(),
      );
    }
    return [...list].sort(
      (a, b) => (a.trendingRank ?? 99) - (b.trendingRank ?? 99),
    );
  }, [dramas, sort]);

  const activeCats = categories
    .filter((c) => c.active)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="slop-cinematic slop-safe-page min-h-[100dvh] px-4 pb-28">
      <div className="mx-auto max-w-6xl animate-fade">
        <SlopWordmark className="mb-6" />
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--slop-violet)]">
          Explore
        </p>
        <h1 className="mb-2 font-display text-4xl font-bold tracking-tight">
          Genres & trending dramas
        </h1>
        <p className="mb-8 max-w-xl text-[var(--slop-slate)]">
          Browse romance, thriller, revenge, fantasy, and more — then dive into
          the next episode.
        </p>

        <section className="mb-10">
          <h2 className="mb-4 font-display text-xl font-bold">Genres</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {activeCats.map((cat) => (
              <GenreTile
                key={cat.id}
                category={cat}
                coverUrl={genreCover(cat.id, published)}
                count={genreCount(cat.id, dramas)}
                size="lg"
                className="w-full min-h-[7rem]"
              />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="font-display text-xl font-bold">
              {sort === "newest" ? "Recently added" : "Trending now"}
            </h2>
            <div className="flex gap-2 text-sm">
              <Link
                href="/explore?sort=trending"
                className={
                  sort !== "newest"
                    ? "text-[var(--slop-violet)]"
                    : "text-[var(--slop-slate)]"
                }
              >
                Trending
              </Link>
              <span className="text-white/20">·</span>
              <Link
                href="/explore?sort=newest"
                className={
                  sort === "newest"
                    ? "text-[var(--slop-violet)]"
                    : "text-[var(--slop-slate)]"
                }
              >
                Newest
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {published.map((drama) => (
              <DramaCard key={drama.id} drama={drama} size="fluid" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--slop-violet)]" />
        </div>
      }
    >
      <ExploreInner />
    </Suspense>
  );
}
