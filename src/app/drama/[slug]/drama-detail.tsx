"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Play } from "lucide-react";
import { SlopWordmark } from "@/components/brand/logo";
import { useSlopStore } from "@/store/slop-store";
import { formatCount } from "@/lib/utils";
import { track } from "@/lib/analytics/client";

export function DramaDetail({ slug }: { slug: string }) {
  const dramas = useSlopStore((s) => s.dramas);
  const videos = useSlopStore((s) => s.videos);
  const categories = useSlopStore((s) => s.categories);
  const hydrated = useSlopStore((s) => s.hydrated);
  const user = useSlopStore((s) => s.currentUser);
  const drama = dramas.find((d) => d.slug === slug && d.status === "published");

  useEffect(() => {
    if (!hydrated || !drama) return;
    void track("drama_viewed", {
      userId: user?.id,
      dramaId: drama.id,
      contentId: drama.id,
    });
  }, [hydrated, drama, user?.id]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--slop-violet)]" />
      </div>
    );
  }

  if (!drama) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-2xl">Drama not found</h1>
        <Link href="/" className="text-[var(--slop-violet)]">
          Back home
        </Link>
      </div>
    );
  }

  const episodes = videos
    .filter((v) => v.dramaId === drama.id && v.status === "published")
    .sort((a, b) => a.episodeNumber - b.episodeNumber);
  const genres = categories.filter((c) => drama.genreIds.includes(c.id));
  const first = episodes[0];

  return (
    <div className="slop-cinematic min-h-[100dvh] pb-28">
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-3">
        <SlopWordmark />
      </header>

      <div className="relative min-h-[360px] sm:min-h-[420px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={drama.bannerUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="slop-hero-mask absolute inset-0" />
        <div className="relative z-10 flex min-h-[360px] flex-col justify-end px-4 pb-8 pt-24 sm:min-h-[420px] sm:px-8">
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <Link
                key={g.id}
                href={`/categories/${g.slug}`}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-[var(--slop-lavender)]"
              >
                {g.name}
              </Link>
            ))}
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            {drama.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
            {drama.synopsis}
          </p>
          <p className="mt-3 text-xs text-[var(--slop-slate)]">
            {drama.sourceAttribution} · {episodes.length} episodes
            {drama.viewCount > 0
              ? ` · ${formatCount(drama.viewCount)} views`
              : ""}
          </p>
          {first && (
            <Link
              href={`/watch?drama=${drama.id}&dramaSlug=${drama.slug}&start=${first.id}`}
              className="mt-6 inline-flex h-12 w-fit items-center gap-2 rounded-xl bg-[var(--slop-violet)] px-6 text-sm font-semibold text-[var(--slop-black)]"
            >
              <Play className="h-4 w-4 fill-current" /> Play Episode 1
            </Link>
          )}
        </div>
      </div>

      <section className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        <h2 className="font-display text-xl font-bold">Episodes</h2>
        <div className="mt-4 space-y-3">
          {episodes.length === 0 && (
            <p className="text-sm text-[var(--slop-slate)]">
              Episodes coming soon.
            </p>
          )}
          {episodes.map((ep) => (
            <Link
              key={ep.id}
              href={`/watch?drama=${drama.id}&dramaSlug=${drama.slug}&start=${ep.id}`}
              className="flex gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[var(--slop-panel)] transition hover:border-[var(--slop-violet)]/40"
            >
              <div className="relative h-24 w-16 shrink-0 sm:w-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ep.thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-[10px] font-bold">
                  EP {ep.episodeNumber}
                </span>
              </div>
              <div className="min-w-0 py-3 pr-3">
                <p className="truncate font-semibold">{ep.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-white/55">
                  {ep.description}
                </p>
                {ep.viewCount > 0 ? (
                  <p className="mt-2 text-[11px] text-[var(--slop-slate)]">
                    {formatCount(ep.viewCount)} views
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
