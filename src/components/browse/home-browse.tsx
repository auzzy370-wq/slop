"use client";

import Link from "next/link";
import { ArrowUpRight, Play, Search } from "lucide-react";
import { SlopWordmark } from "@/components/brand/logo";
import { DramaCard } from "@/components/browse/drama-card";
import { ContinueWatchingRow } from "@/components/browse/continue-watching-row";
import {
  GenreTile,
  genreCount,
  genreCover,
} from "@/components/browse/genre-tile";
import { sortDramasByChart } from "@/lib/engagement";
import { useSlopStore } from "@/store/slop-store";
import { getContinueForDrama } from "@/lib/continue-watching";
import { formatCount } from "@/lib/utils";
import { watchHref } from "@/lib/watch-url";
import type { Drama } from "@/lib/types";

export function HomeBrowse() {
  const dramas = useSlopStore((s) => s.dramas);
  const categories = useSlopStore((s) => s.categories);
  const videos = useSlopStore((s) => s.videos);
  const settings = useSlopStore((s) => s.settings);
  const hydrated = useSlopStore((s) => s.hydrated);
  const user = useSlopStore((s) => s.currentUser);

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center slop-cinematic">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[var(--slop-violet)]" />
      </div>
    );
  }

  const published = dramas.filter((d) => d.status === "published");
  // Hero: prefer the live chart leader so a watched upload can take the top slot
  // over a hardcoded featured seed with no traffic.
  const chart = sortDramasByChart(published, videos);
  const featured =
    chart[0] ??
    published.filter((d) => settings.featuredDramaIds.includes(d.id))[0] ??
    published.find((d) => d.featured) ??
    published[0];
  const trending = chart.slice(0, 8);
  const newest = [...published].sort(
    (a, b) =>
      new Date(b.publishedAt ?? b.createdAt).getTime() -
      new Date(a.publishedAt ?? a.createdAt).getTime(),
  );
  const firstEpisode = videos.find(
    (v) =>
      v.dramaId === featured?.id &&
      v.status === "published" &&
      v.episodeNumber === 1,
  );
  const featuredContinue = featured
    ? getContinueForDrama(featured.id)
    : null;
  const featuredContinueEpisode = featuredContinue
    ? videos.find((v) => v.id === featuredContinue.episodeId)
    : null;
  const activeCats = categories
    .filter((c) => c.active)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="slop-cinematic min-h-[100dvh] pb-28 lg:pb-16">
      {/* Mobile header — desktop uses DesktopNav */}
      <header className="slop-safe-header sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-white/5 bg-[rgba(17,17,22,0.92)] px-4 backdrop-blur-xl lg:hidden">
        <SlopWordmark className="min-w-0" />
        <div className="flex shrink-0 items-center gap-2">
          {user?.isPremium && (
            <span className="hidden rounded-full border border-[var(--slop-violet)]/40 bg-[var(--slop-violet)]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--slop-lavender)] sm:inline">
              Premium
            </span>
          )}
          <Link
            href="/search"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/80 hover:bg-white/10"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {featured && (
        <section className="relative isolate min-h-[72vw] overflow-hidden sm:min-h-[420px] lg:mt-0 lg:min-h-[min(72vh,640px)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={featured.bannerUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover animate-fade"
          />
          <div className="slop-hero-mask absolute inset-0" />
          <div className="relative z-10 mx-auto flex h-full min-h-[72vw] w-full max-w-[1400px] flex-col justify-end px-4 pb-10 pt-24 sm:min-h-[420px] sm:px-8 lg:min-h-[min(72vh,640px)] lg:justify-center lg:px-12 lg:pb-16 lg:pt-20">
            <div className="max-w-2xl">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--slop-violet)]">
                {settings.tagline}
              </p>
              <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
                Find Your Next Obsession.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base lg:text-lg">
                Discover original AI-powered dramas across romance, thriller,
                revenge, fantasy, and more. Watch anywhere. Discover something
                new. Get hooked.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={
                    featuredContinueEpisode
                      ? watchHref({
                          episodeId: featuredContinueEpisode.id,
                          dramaId: featured.id,
                          dramaSlug: featured.slug,
                        })
                      : firstEpisode
                        ? watchHref({
                            episodeId: firstEpisode.id,
                            dramaId: featured.id,
                            dramaSlug: featured.slug,
                          })
                        : `/drama/${featured.slug}`
                  }
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--slop-violet)] px-6 text-sm font-semibold text-[var(--slop-black)] transition hover:brightness-110"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {featuredContinueEpisode
                    ? `Continue Ep ${featuredContinue!.episodeNumber}`
                    : `Watch ${featured.title}`}
                </Link>
                <Link
                  href={`/drama/${featured.slug}`}
                  className="inline-flex h-12 items-center rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/10"
                >
                  Details
                </Link>
              </div>
              <p className="mt-4 text-xs text-[var(--slop-slate)]">
                Featured ·{" "}
                {featured.viewCount > 0
                  ? `${formatCount(featured.viewCount)} views`
                  : "Just published"}{" "}
                · {featured.episodeCount} episodes
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-[1400px] space-y-10 px-4 pt-8 sm:px-6 lg:space-y-14 lg:px-12 lg:pt-12">
        <ContinueWatchingRow />

        <section>
          <div className="mb-3 flex items-end justify-between lg:mb-5">
            <h2 className="font-display text-xl font-bold lg:text-2xl">
              Genres
            </h2>
            <Link href="/explore" className="text-sm text-[var(--slop-violet)]">
              See all
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible xl:grid-cols-6">
            {activeCats.map((cat) => (
              <GenreTile
                key={cat.id}
                category={cat}
                coverUrl={genreCover(cat.id, published)}
                count={genreCount(cat.id, published)}
                className="lg:w-full lg:min-h-[7.5rem]"
              />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--slop-violet)]">
                Chart
              </p>
              <h2 className="mt-1 font-display text-xl font-bold sm:text-2xl">
                Rising on SLOP
              </h2>
            </div>
            <Link
              href="/explore?sort=trending"
              className="shrink-0 text-sm text-[var(--slop-violet)]"
            >
              See all
            </Link>
          </div>
          <ol className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-[var(--slop-panel)]/60 lg:grid lg:grid-cols-2 lg:divide-y-0 lg:gap-px lg:bg-white/10">
            {trending.map((drama, index) => (
              <RankRow key={drama.id} drama={drama} rank={index + 1} />
            ))}
          </ol>
        </section>

        <BrowseRow title="Recently Added" href="/explore?sort=newest">
          {newest.slice(0, 12).map((d) => (
            <DramaCard key={d.id} drama={d} />
          ))}
        </BrowseRow>

        {activeCats.slice(0, 4).map((cat) => {
          const row = published.filter((d) => d.genreIds.includes(cat.id));
          if (row.length === 0) return null;
          return (
            <BrowseRow
              key={cat.id}
              title={cat.name}
              href={`/categories/${cat.slug}`}
            >
              {row.slice(0, 12).map((d) => (
                <DramaCard key={d.id} drama={d} />
              ))}
            </BrowseRow>
          );
        })}

        <section className="overflow-hidden rounded-3xl border border-[var(--slop-violet)]/25 bg-gradient-to-br from-[rgba(185,154,255,0.16)] to-transparent p-6 sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:p-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--slop-lavender)]">
              SLOP Premium
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
              Drama without the interruptions
            </h2>
            <p className="mt-2 max-w-lg text-sm text-white/70 lg:text-base">
              Go ad-free for {settings.premiumPriceLabel}. Same stories. Cleaner
              binge. Cancel anytime.
            </p>
          </div>
          <Link
            href="/premium"
            className="mt-5 inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--slop-violet)] px-5 text-sm font-semibold text-[var(--slop-black)] transition hover:brightness-110 lg:mt-0"
          >
            Start Premium
          </Link>
        </section>
      </div>
    </div>
  );
}

function RankRow({ drama, rank }: { drama: Drama; rank: number }) {
  const n = String(rank).padStart(2, "0");
  return (
    <li className="bg-[var(--slop-panel)]/60 lg:bg-[rgba(17,17,22,0.92)]">
      <Link
        href={`/drama/${drama.slug}`}
        className="group flex items-center gap-3 px-3 py-3.5 transition hover:bg-white/[0.03] sm:gap-4 sm:px-4"
      >
        <span
          aria-hidden
          className="slop-home-rank-num w-[2.4ch] shrink-0 font-display text-2xl font-bold leading-none tracking-[-0.04em] text-transparent sm:text-3xl"
        >
          {n}
        </span>
        <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md sm:h-16 sm:w-11">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={drama.posterUrl}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold tracking-tight text-white sm:text-lg">
            {drama.title}
          </p>
          <p className="mt-0.5 text-xs text-white/45">
            {drama.episodeCount} eps
            {drama.viewCount > 0
              ? ` · ${formatCount(drama.viewCount)} watched`
              : ""}
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:text-[var(--slop-violet)]" />
      </Link>
    </li>
  );
}

function BrowseRow({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between lg:mb-5">
        <h2 className="font-display text-xl font-bold lg:text-2xl">{title}</h2>
        <Link href={href} className="text-sm text-[var(--slop-violet)]">
          See all
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible xl:grid-cols-6">
        {children}
      </div>
    </section>
  );
}
