"use client";

import Link from "next/link";
import { Play, X } from "lucide-react";
import { useContinueWatching } from "@/hooks/use-continue-watching";
import {
  continueProgressRatio,
  formatRemaining,
} from "@/lib/continue-watching";
import { watchHref } from "@/lib/watch-url";
import { useSlopStore } from "@/store/slop-store";

export function ContinueWatchingRow() {
  const { entries, remove } = useContinueWatching();
  const dramas = useSlopStore((s) => s.dramas);
  const videos = useSlopStore((s) => s.videos);
  const hydrated = useSlopStore((s) => s.hydrated);

  if (!hydrated || entries.length === 0) return null;

  const cards = entries
    .map((entry) => {
      const drama = dramas.find((d) => d.id === entry.dramaId);
      const episode = videos.find((v) => v.id === entry.episodeId);
      if (!drama || !episode || episode.status !== "published") return null;
      return { entry, drama, episode };
    })
    .filter(Boolean)
    .slice(0, 12) as Array<{
    entry: (typeof entries)[number];
    drama: (typeof dramas)[number];
    episode: (typeof videos)[number];
  }>;

  if (cards.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--slop-violet)]">
            Pick up where you left off
          </p>
          <h2 className="mt-1 font-display text-xl font-bold sm:text-2xl">
            Continue Watching
          </h2>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none sm:gap-4 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible xl:grid-cols-6">
        {cards.map(({ entry, drama, episode }) => {
          const ratio = continueProgressRatio(entry);
          const href = watchHref({
            episodeId: episode.id,
            dramaId: drama.id,
            dramaSlug: drama.slug,
          });
          return (
            <div
              key={entry.dramaId}
              className="relative w-36 shrink-0 snap-start sm:w-40 lg:w-full lg:min-w-0"
            >
              <Link
                href={href}
                className="group block overflow-hidden rounded-xl border border-white/10 bg-[var(--slop-panel)] transition hover:border-[var(--slop-violet)]/50"
              >
                <div className="relative aspect-[2/3] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={episode.thumbnailUrl || drama.posterUrl}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white opacity-90 backdrop-blur-md transition group-hover:scale-105">
                    <Play className="ml-0.5 h-5 w-5 fill-white" />
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-2.5">
                    <p className="line-clamp-2 text-xs font-semibold leading-snug text-white sm:text-sm">
                      {drama.title}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--slop-lavender)]/90">
                      Ep {entry.episodeNumber} · {formatRemaining(entry)}
                    </p>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-[var(--slop-violet)]"
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  remove(entry.dramaId);
                }}
                className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/80 backdrop-blur hover:bg-black/80 hover:text-white"
                aria-label={`Remove ${drama.title} from continue watching`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
