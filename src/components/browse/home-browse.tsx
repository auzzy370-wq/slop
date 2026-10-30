"use client";

import Link from "next/link";
import { Play, Search } from "lucide-react";
import { SlopWordmark } from "@/components/brand/logo";
import { DramaCard } from "@/components/browse/drama-card";
import { useSlopStore } from "@/store/slop-store";
import { formatCount } from "@/lib/utils";

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
  const featured =
    published.filter((d) => settings.featuredDramaIds.includes(d.id))[0] ??
    published.find((d) => d.featured) ??
    published[0];
  const trending = [...published].sort(
    (a, b) => (a.trendingRank ?? 99) - (b.trendingRank ?? 99),
  );
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

  return (
    <div className="slop-cinematic min-h-[100dvh] pb-28">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-white/5 bg-[rgba(17,17,22,0.75)] px-4 py-3 backdrop-blur-xl">
        <SlopWordmark />
        <div className="flex items-center gap-2">
          {user?.isPremium && (
            <span className="hidden rounded-full border border-[var(--slop-violet)]/40 bg-[var(--slop-violet)]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--slop-lavender)] sm:inline">
              Premium
            </span>
          )}
          <Link
            href="/search"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/80 hover:bg-white/10"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {featured && (
        <section className="relative isolate min-h-[72vw] overflow-hidden sm:min-h-[420px] lg:min-h-[520px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={featured.bannerUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover animate-fade"
          />
          <div className="slop-hero-mask absolute inset-0" />
          <div className="relative z-10 flex h-full min-h-[72vw] flex-col justify-end px-4 pb-10 pt-24 sm:min-h-[420px] sm:max-w-2xl sm:px-8 lg:min-h-[520px] lg:px-12">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--slop-violet)]">
              {settings.tagline}
            </p>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Find Your Next Obsession.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
              Discover original AI-powered dramas across romance, thriller,
              revenge, fantasy, and more. Watch anywhere. Discover something
              new. Get hooked.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={
                  firstEpisode
                    ? `/watch?start=${firstEpisode.id}`
                    : `/drama/${featured.slug}`
                }
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--slop-violet)] px-6 text-sm font-semibold text-[var(--slop-black)] transition hover:brightness-110"
              >
                <Play className="h-4 w-4 fill-current" />
                Watch {featured.title}
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
        </section>
      )}

      <div className="mx-auto max-w-6xl space-y-10 px-4 pt-8 sm:px-6">
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl font-bold">Genres</h2>
            <Link href="/explore" className="text-sm text-[var(--slop-violet)]">
              See all
            </Link>
          </div>
          <div className="row-scroll">
            {categories
              .filter((c) => c.active)
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  className="shrink-0 rounded-2xl border border-white/10 bg-[var(--slop-panel)] px-4 py-3 transition hover:border-[var(--slop-violet)]/40 hover:bg-[var(--slop-panel-elevated)]"
                >
                  <span className="text-[var(--slop-violet)]">{cat.icon}</span>
                  <p className="mt-1 text-sm font-semibold">{cat.name}</p>
                </Link>
              ))}
          </div>
        </section>

        <BrowseRow title="Trending Now" href="/explore?sort=trending">
          {trending.map((d) => (
            <DramaCard key={d.id} drama={d} />
          ))}
        </BrowseRow>

        <BrowseRow title="Recently Added" href="/explore?sort=newest">
          {newest.map((d) => (
            <DramaCard key={d.id} drama={d} />
          ))}
        </BrowseRow>

        {categories
          .filter((c) => c.active)
          .slice(0, 4)
          .map((cat) => {
            const row = published.filter((d) => d.genreIds.includes(cat.id));
            if (row.length === 0) return null;
            return (
              <BrowseRow
                key={cat.id}
                title={cat.name}
                href={`/categories/${cat.slug}`}
              >
                {row.map((d) => (
                  <DramaCard key={d.id} drama={d} />
                ))}
              </BrowseRow>
            );
          })}

        <section className="overflow-hidden rounded-3xl border border-[var(--slop-violet)]/25 bg-gradient-to-br from-[rgba(185,154,255,0.16)] to-transparent p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--slop-lavender)]">
            SLOP Premium
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
            Drama without the interruptions
          </h2>
          <p className="mt-2 max-w-lg text-sm text-white/70">
            Go ad-free for {settings.premiumPriceLabel}. Same stories. Cleaner
            binge. Cancel anytime.
          </p>
          <Link
            href="/premium"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[var(--slop-violet)] px-5 text-sm font-semibold text-[var(--slop-black)] transition hover:brightness-110"
          >
            Start Premium
          </Link>
        </section>
      </div>
    </div>
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
      <div className="mb-3 flex items-end justify-between">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <Link href={href} className="text-sm text-[var(--slop-violet)]">
          See all
        </Link>
      </div>
      <div className="row-scroll">{children}</div>
    </section>
  );
}
