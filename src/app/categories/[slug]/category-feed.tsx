"use client";

import Link from "next/link";
import { SlopWordmark } from "@/components/brand/logo";
import { DramaCard } from "@/components/browse/drama-card";
import { useSlopStore } from "@/store/slop-store";

export function CategoryFeed({ slug }: { slug: string }) {
  const categories = useSlopStore((s) => s.categories);
  const dramas = useSlopStore((s) => s.dramas);
  const videos = useSlopStore((s) => s.videos);
  const hydrated = useSlopStore((s) => s.hydrated);
  const category = categories.find((c) => c.slug === slug && c.active);

  if (!hydrated) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--slop-violet)]" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-2xl">Genre not found</h1>
        <Link href="/explore" className="text-[var(--slop-violet)]">
          Browse explore
        </Link>
      </div>
    );
  }

  const list = dramas.filter(
    (d) => d.status === "published" && d.genreIds.includes(category.id),
  );
  const firstEpisode = videos.find(
    (v) =>
      v.status === "published" &&
      v.categoryIds.includes(category.id) &&
      v.episodeNumber === 1,
  );

  return (
    <div className="slop-cinematic min-h-[100dvh] px-4 pb-28 pt-6">
      <div className="mx-auto max-w-6xl">
        <SlopWordmark className="mb-6" />
        <p className="text-[var(--slop-violet)]">{category.icon}</p>
        <h1 className="mt-1 font-display text-4xl font-bold">{category.name}</h1>
        <p className="mt-2 max-w-xl text-[var(--slop-slate)]">
          {category.description}
        </p>
        {firstEpisode && (
          <Link
            href={`/watch?start=${firstEpisode.id}`}
            className="mt-5 inline-flex h-11 items-center rounded-xl bg-[var(--slop-violet)] px-5 text-sm font-semibold text-[var(--slop-black)]"
          >
            Start watching {category.name}
          </Link>
        )}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {list.map((drama) => (
            <div key={drama.id} className="flex justify-center">
              <DramaCard drama={drama} size="lg" />
            </div>
          ))}
        </div>
        {list.length === 0 && (
          <p className="mt-8 text-sm text-[var(--slop-slate)]">
            No dramas in this genre yet.
          </p>
        )}
      </div>
    </div>
  );
}
