"use client";

import Link from "next/link";
import { ArrowLeft, Play } from "lucide-react";
import { DramaCard } from "@/components/browse/drama-card";
import { GenreTile, genreCount, genreCover } from "@/components/browse/genre-tile";
import { useSlopStore } from "@/store/slop-store";

export function CategoryFeed({ slug }: { slug: string }) {
  const categories = useSlopStore((s) => s.categories);
  const dramas = useSlopStore((s) => s.dramas);
  const videos = useSlopStore((s) => s.videos);
  const hydrated = useSlopStore((s) => s.hydrated);
  const category = categories.find((c) => c.slug === slug && c.active);

  if (!hydrated) {
    return (
      <div className="flex h-[100dvh] items-center justify-center slop-cinematic">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--slop-violet)]" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center slop-cinematic">
        <h1 className="font-display text-2xl">Genre not found</h1>
        <Link href="/explore" className="text-[var(--slop-violet)]">
          Browse explore
        </Link>
      </div>
    );
  }

  const published = dramas.filter((d) => d.status === "published");
  const list = published.filter((d) => d.genreIds.includes(category.id));
  const cover = genreCover(category.id, published, "banner");
  const otherGenres = categories
    .filter((c) => c.active && c.id !== category.id)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const featuredDrama = list[0];
  const firstEpisode = featuredDrama
    ? videos.find(
        (v) =>
          v.dramaId === featuredDrama.id &&
          v.status === "published" &&
          v.episodeNumber === 1,
      )
    : undefined;

  return (
    <div className="slop-cinematic min-h-[100dvh] pb-28 lg:pb-16">
      <section className="relative isolate min-h-[42vw] overflow-hidden sm:min-h-[320px] lg:min-h-[380px]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--slop-panel)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--slop-black)] via-[rgba(17,17,22,0.72)] to-[rgba(17,17,22,0.45)]" />

        <div className="relative z-10 mx-auto flex min-h-[42vw] max-w-[1400px] flex-col justify-end px-4 pb-8 pt-6 sm:min-h-[320px] sm:px-6 lg:min-h-[380px] lg:px-12 lg:pb-12 lg:pt-20">
          <Link
            href="/explore"
            className="mb-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-md transition hover:bg-black/50 lg:mb-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All genres
          </Link>

          <p className="mt-10 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--slop-violet)]">
            Genre
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {category.name}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
            {category.description}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {firstEpisode ? (
              <Link
                href={`/watch?start=${firstEpisode.id}`}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--slop-violet)] px-5 text-sm font-semibold text-[var(--slop-black)] transition hover:brightness-110"
              >
                <Play className="h-4 w-4 fill-current" />
                Watch {featuredDrama?.title}
              </Link>
            ) : null}
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">
              {list.length} {list.length === 1 ? "show" : "shows"}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6 lg:px-12 lg:pt-10">
        {otherGenres.length > 0 ? (
          <section className="mb-8">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
              Jump to
            </p>
            <div className="row-scroll gap-2 lg:flex-wrap lg:overflow-visible">
              {otherGenres.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  className="shrink-0 rounded-lg border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-sm font-medium text-white/70 transition hover:border-[var(--slop-violet)]/40 hover:text-white"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-display text-xl font-bold lg:text-2xl">
              {category.name} on SLOP
            </h2>
          </div>
          {list.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 md:gap-4">
              {list.map((drama) => (
                <DramaCard key={drama.id} drama={drama} size="fluid" />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/12 px-6 py-14 text-center">
              <p className="font-display text-lg font-semibold text-white/80">
                Nothing here yet
              </p>
              <p className="mt-2 text-sm text-white/45">
                New {category.name.toLowerCase()} dramas will land here first.
              </p>
              <Link
                href="/explore"
                className="mt-5 inline-flex text-sm font-semibold text-[var(--slop-violet)]"
              >
                Explore other genres
              </Link>
            </div>
          )}
        </section>

        {otherGenres.length > 0 ? (
          <section className="mt-12">
            <h2 className="mb-4 font-display text-xl font-bold">More moods</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 lg:gap-4">
              {otherGenres.slice(0, 6).map((cat) => (
                <GenreTile
                  key={cat.id}
                  category={cat}
                  coverUrl={genreCover(cat.id, published)}
                  count={genreCount(cat.id, published)}
                  size="lg"
                  className="w-full min-h-[6.5rem] lg:min-h-[7.5rem]"
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
