"use client";

import Link from "next/link";
import { Play, Search, ArrowUpRight } from "lucide-react";
import { DramaCard } from "@/components/browse/drama-card";
import { useSlopStore } from "@/store/slop-store";
import { formatCount } from "@/lib/utils";
import type { Drama, Video } from "@/lib/types";

export function HomeBrowse() {
  const dramas = useSlopStore((s) => s.dramas);
  const categories = useSlopStore((s) => s.categories);
  const videos = useSlopStore((s) => s.videos);
  const settings = useSlopStore((s) => s.settings);
  const hydrated = useSlopStore((s) => s.hydrated);
  const user = useSlopStore((s) => s.currentUser);

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--slop-black)]">
        <div className="slop-home-loader" />
      </div>
    );
  }

  const published = dramas.filter((d) => d.status === "published");
  const featured =
    published.filter((d) => settings.featuredDramaIds.includes(d.id))[0] ??
    published.find((d) => d.featured) ??
    published[0];
  const trending = [...published]
    .sort((a, b) => (a.trendingRank ?? 99) - (b.trendingRank ?? 99))
    .slice(0, 6);
  const newest = [...published]
    .sort(
      (a, b) =>
        new Date(b.publishedAt ?? b.createdAt).getTime() -
        new Date(a.publishedAt ?? a.createdAt).getTime(),
    )
    .slice(0, 8);
  const activeCats = categories
    .filter((c) => c.active)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const featuredEps = videos
    .filter(
      (v) =>
        v.dramaId === featured?.id &&
        v.status === "published",
    )
    .sort((a, b) => a.episodeNumber - b.episodeNumber);

  const firstEpisode = featuredEps.find((v) => v.episodeNumber === 1);
  const watchHref = firstEpisode
    ? `/watch?start=${firstEpisode.id}`
    : featured
      ? `/drama/${featured.slug}`
      : "/watch";

  return (
    <div className="slop-home min-h-[100dvh] pb-28">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between px-4 pt-[max(0.85rem,env(safe-area-inset-top))] sm:px-6">
        <div className="pointer-events-auto mt-1 flex items-center gap-2">
          {user?.isPremium ? (
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--slop-lavender)]/70">
              Premium
            </span>
          ) : null}
        </div>
        <Link
          href="/search"
          className="pointer-events-auto mt-1 flex h-10 w-10 items-center justify-center border border-white/15 bg-black/35 text-white/85 backdrop-blur-md transition hover:border-white/30 hover:text-white"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Link>
      </header>

      {/* Hero — one composition: brand + line + CTA + full-bleed image */}
      <section className="relative isolate min-h-[100svh] overflow-hidden">
        {featured ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={featured.bannerUrl}
              alt=""
              className="slop-home-hero-img absolute inset-0 h-full w-full object-cover"
            />
          </>
        ) : null}
        <div className="slop-home-hero-veil absolute inset-0" />
        <div className="slop-home-hero-grain absolute inset-0" aria-hidden />
        <div className="slop-home-hero-rail absolute inset-y-0 left-0 w-[3px]" aria-hidden />

        <div className="relative z-10 flex min-h-[100svh] flex-col justify-end px-4 pb-[max(5.5rem,env(safe-area-inset-bottom))] pt-28 sm:px-8 lg:px-12">
          <p className="slop-home-rise font-display text-[clamp(4.5rem,22vw,11rem)] font-bold leading-[0.82] tracking-[-0.06em] text-white">
            SLOP
            <span className="text-[var(--slop-violet)]">.</span>
          </p>
          <p className="slop-home-rise-delay mt-4 max-w-md text-[15px] leading-relaxed text-white/70 sm:text-base">
            {settings.tagline} Vertical dramas made to keep you watching.
          </p>
          <div className="slop-home-rise-delay2 mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={watchHref}
              className="slop-home-cta inline-flex h-12 items-center gap-2 bg-[var(--slop-violet)] px-6 text-sm font-semibold text-[var(--slop-black)] transition hover:brightness-110"
            >
              <Play className="h-4 w-4 fill-current" />
              Start watching
            </Link>
            {featured ? (
              <Link
                href={`/drama/${featured.slug}`}
                className="inline-flex h-12 items-center gap-1.5 border border-white/20 bg-black/25 px-5 text-sm font-semibold text-white backdrop-blur-md transition hover:border-white/40"
              >
                {featured.title}
                <ArrowUpRight className="h-4 w-4 opacity-70" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Featured show — editorial, not a card grid */}
      {featured ? (
        <section className="relative border-t border-white/10 px-4 py-14 sm:px-8 lg:px-12">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-end lg:gap-12">
            <div className="slop-home-feature-copy order-2 lg:order-1">
              <div className="flex items-center gap-3">
                <span className="slop-meta-slash" aria-hidden />
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--slop-violet)]">
                  Opening night
                </p>
              </div>
              <h2 className="mt-4 font-display text-[clamp(2.25rem,6vw,3.75rem)] font-bold leading-[0.95] tracking-[-0.03em] text-white">
                {featured.title}
              </h2>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">
                {featured.synopsis}
              </p>
              <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-white/35">
                {featured.episodeCount} episodes
                {featured.viewCount > 0
                  ? ` · ${formatCount(featured.viewCount)} watched`
                  : " · New on SLOP"}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={watchHref}
                  className="inline-flex h-11 items-center gap-2 bg-white px-5 text-sm font-semibold text-[var(--slop-black)] transition hover:bg-[var(--slop-lavender)]"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Episode 1
                </Link>
                <Link
                  href={`/drama/${featured.slug}`}
                  className="inline-flex h-11 items-center border border-white/15 px-5 text-sm font-semibold text-white/85 transition hover:border-white/35"
                >
                  Full series
                </Link>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="slop-home-poster-frame relative mx-auto aspect-[2/3] max-w-[280px] overflow-hidden sm:max-w-sm lg:ml-auto lg:mr-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featured.posterUrl}
                  alt={featured.title}
                  className="h-full w-full object-cover"
                />
                <div className="slop-home-poster-shine pointer-events-none absolute inset-0" />
              </div>
            </div>
          </div>

          {featuredEps.length > 0 ? (
            <div className="mx-auto mt-12 max-w-6xl">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40">
                Episode reel
              </p>
              <div className="row-scroll gap-3">
                {featuredEps.map((ep) => (
                  <EpisodeChip key={ep.id} episode={ep} />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Genres as typographic index — not emoji cards */}
      <section className="border-t border-white/10 px-4 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/40">
            Browse by mood
          </p>
          <nav
            aria-label="Genres"
            className="slop-home-genre-index mt-5 flex flex-wrap items-baseline gap-x-1 gap-y-3"
          >
            {activeCats.map((cat, i) => (
              <span key={cat.id} className="inline-flex items-baseline">
                {i > 0 ? (
                  <span className="mx-2 text-white/20" aria-hidden>
                    /
                  </span>
                ) : null}
                <Link
                  href={`/categories/${cat.slug}`}
                  className="slop-home-genre-link font-display text-[clamp(1.35rem,4vw,2rem)] font-semibold tracking-tight text-white/55 transition hover:text-[var(--slop-lavender)]"
                >
                  {cat.name}
                </Link>
              </span>
            ))}
          </nav>
        </div>
      </section>

      {/* Ranked — large numbers, editorial */}
      <section className="border-t border-white/10 px-4 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--slop-violet)]">
                Chart
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Rising on SLOP
              </h2>
            </div>
            <Link
              href="/explore?sort=trending"
              className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45 transition hover:text-[var(--slop-lavender)]"
            >
              Full chart
            </Link>
          </div>

          <ol className="space-y-0 divide-y divide-white/10">
            {trending.map((drama, index) => (
              <RankRow key={drama.id} drama={drama} rank={index + 1} />
            ))}
          </ol>
        </div>
      </section>

      {/* Fresh drops — horizontal posters, quieter */}
      <section className="border-t border-white/10 px-4 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/40">
                Just dropped
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">
                New episodes
              </h2>
            </div>
            <Link
              href="/explore?sort=newest"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45 transition hover:text-[var(--slop-lavender)]"
            >
              See all
            </Link>
          </div>
          <div className="row-scroll gap-4">
            {newest.map((d) => (
              <DramaCard key={d.id} drama={d} size="lg" />
            ))}
          </div>
        </div>
      </section>

      {/* Premium — full-bleed strip, not a boxed card */}
      <section className="slop-home-premium relative overflow-hidden border-t border-white/10 px-4 py-16 sm:px-8 lg:px-12">
        <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-lg">
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.32em] text-[var(--slop-lavender)]">
              SLOP Premium
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.05] tracking-tight">
              Watch without the noise.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              Ad-free bingeing for {settings.premiumPriceLabel}. Same dramas.
              Cleaner screen.
            </p>
          </div>
          <Link
            href="/premium"
            className="inline-flex h-12 shrink-0 items-center justify-center bg-[var(--slop-violet)] px-6 text-sm font-semibold text-[var(--slop-black)] transition hover:brightness-110"
          >
            Go Premium
          </Link>
        </div>
      </section>
    </div>
  );
}

function EpisodeChip({ episode }: { episode: Video }) {
  const n = String(episode.episodeNumber).padStart(2, "0");
  return (
    <Link
      href={`/watch?start=${episode.id}`}
      className="slop-home-ep-chip group relative flex w-[9.5rem] shrink-0 snap-start flex-col overflow-hidden border border-white/12 bg-[var(--slop-panel)] transition hover:border-[var(--slop-violet)]/45"
    >
      <div className="relative aspect-[9/14] overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={episode.thumbnailUrl}
          alt=""
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <span className="absolute left-2 top-2 font-display text-[10px] font-bold tracking-[0.14em] text-white/90">
          EP {n}
        </span>
      </div>
      <div className="px-2.5 py-2.5">
        <p className="line-clamp-2 text-[11px] font-medium leading-snug text-white/80">
          {episode.title}
        </p>
      </div>
    </Link>
  );
}

function RankRow({ drama, rank }: { drama: Drama; rank: number }) {
  const n = String(rank).padStart(2, "0");
  return (
    <li>
      <Link
        href={`/drama/${drama.slug}`}
        className="group flex items-center gap-4 py-5 transition sm:gap-6"
      >
        <span
          aria-hidden
          className="slop-home-rank-num font-display text-[clamp(2.5rem,8vw,4.5rem)] font-bold leading-none tracking-[-0.06em] text-transparent"
        >
          {n}
        </span>
        <div className="relative h-20 w-14 shrink-0 overflow-hidden sm:h-24 sm:w-[4.25rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={drama.posterUrl}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold tracking-tight text-white sm:text-xl">
            {drama.title}
          </p>
          <p className="mt-1 line-clamp-1 text-sm text-white/45">
            {drama.episodeCount} eps
            {drama.viewCount > 0
              ? ` · ${formatCount(drama.viewCount)} watched`
              : ""}
          </p>
        </div>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-white/25 transition group-hover:text-[var(--slop-violet)]" />
      </Link>
    </li>
  );
}
