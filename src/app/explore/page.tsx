"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { SlopWordmark } from "@/components/brand/logo";
import { DramaCard } from "@/components/browse/drama-card";
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

  return (
    <div className="slop-cinematic min-h-[100dvh] px-4 pb-28 pt-6">
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
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--slop-slate)]">
            Genres
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {categories
              .filter((c) => c.active)
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  className="group rounded-2xl border border-white/10 bg-[var(--slop-panel)] p-4 transition hover:border-[var(--slop-violet)]/40 hover:bg-[var(--slop-panel-elevated)]"
                >
                  <span className="mb-3 block text-[var(--slop-violet)]">
                    {cat.icon}
                  </span>
                  <p className="font-semibold text-white group-hover:text-[var(--slop-lavender)]">
                    {cat.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--slop-slate)]">
                    {cat.description}
                  </p>
                </Link>
              ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--slop-slate)]">
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
              <div key={drama.id} className="flex justify-center">
                <DramaCard drama={drama} size="lg" />
              </div>
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
