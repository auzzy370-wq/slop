"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Keyboard,
  Play,
} from "lucide-react";
import { VideoFeed } from "@/components/feed/video-feed";
import { useSlopStore } from "@/store/slop-store";
import { formatCount } from "@/lib/utils";

function WatchInner() {
  const params = useSearchParams();
  const start = params.get("start") ?? undefined;
  const dramaId = params.get("drama") ?? undefined;
  const dramaSlug = params.get("dramaSlug") ?? undefined;
  const feed = params.get("feed");

  const videos = useSlopStore((s) => s.videos);
  const dramas = useSlopStore((s) => s.dramas);
  const hydrated = useSlopStore((s) => s.hydrated);

  const startVideo = useMemo(() => {
    if (!hydrated) return undefined;
    if (start) return videos.find((v) => v.id === start);
    if (dramaId) {
      return videos
        .filter((v) => v.dramaId === dramaId && v.status === "published")
        .sort((a, b) => a.episodeNumber - b.episodeNumber)[0];
    }
    return videos.find((v) => v.status === "published");
  }, [hydrated, videos, start, dramaId]);

  const drama = useMemo(() => {
    if (!startVideo) return dramas.find((d) => d.slug === dramaSlug);
    return dramas.find((d) => d.id === startVideo.dramaId);
  }, [dramas, startVideo, dramaSlug]);

  const episodeList = useMemo(() => {
    if (!drama) return [];
    return videos
      .filter((v) => v.dramaId === drama.id && v.status === "published")
      .sort((a, b) => a.episodeNumber - b.episodeNumber)
      .slice(0, 8);
  }, [videos, drama]);

  const backHref = dramaSlug
    ? `/drama/${dramaSlug}`
    : drama
      ? `/drama/${drama.slug}`
      : "/";

  return (
    <div className="slop-watch-shell">
      {/* Mobile back control */}
      <Link
        href={backHref}
        className="fixed left-4 z-50 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur top-[max(1rem,env(safe-area-inset-top))] lg:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {/* Desktop left rail — series context */}
      <aside className="hidden w-full max-w-sm justify-self-end lg:flex lg:flex-col lg:gap-6 lg:pr-2">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-white/60 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {drama ? "Back to series" : "Back home"}
        </Link>

        {drama ? (
          <div className="animate-fade">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--slop-violet)]">
              Now watching
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">
              {drama.title}
            </h1>
            <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-white/55">
              {drama.synopsis}
            </p>
            <p className="mt-4 text-xs text-white/40">
              {drama.episodeCount} episodes
              {drama.viewCount > 0
                ? ` · ${formatCount(drama.viewCount)} views`
                : ""}
            </p>
            <Link
              href={`/drama/${drama.slug}`}
              className="mt-5 inline-flex h-10 items-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Series details
            </Link>
          </div>
        ) : (
          <div className="animate-fade">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--slop-violet)]">
              For you
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">
              Keep scrolling
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              Swipe or scroll through original short dramas. New episodes drop
              into the feed as they publish.
            </p>
          </div>
        )}
      </aside>

      {/* Phone stage */}
      <div className="slop-watch-stage">
        <VideoFeed
          section={
            dramaId ? "drama" : feed === "trending" ? "trending" : "for-you"
          }
          categoryId={dramaId ?? undefined}
          startVideoId={start}
        />
      </div>

      {/* Desktop right rail — episodes + tips */}
      <aside className="hidden w-full max-w-xs justify-self-start lg:flex lg:flex-col lg:gap-5 lg:pl-2">
        {episodeList.length > 0 && drama && (
          <div className="animate-fade rounded-2xl border border-white/10 bg-[var(--slop-panel)]/70 p-4 backdrop-blur-xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              Episodes
            </p>
            <ul className="mt-3 space-y-1">
              {episodeList.map((ep) => {
                const active = startVideo?.id === ep.id;
                return (
                  <li key={ep.id}>
                    <Link
                      href={`/watch?start=${ep.id}&dramaSlug=${drama.slug}`}
                      className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition ${
                        active
                          ? "bg-[var(--slop-violet)]/20 text-white"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          active
                            ? "bg-[var(--slop-violet)] text-[var(--slop-black)]"
                            : "bg-white/5"
                        }`}
                      >
                        {active ? (
                          <Play className="h-3.5 w-3.5 fill-current" />
                        ) : (
                          String(ep.episodeNumber).padStart(2, "0")
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {ep.title || `Episode ${ep.episodeNumber}`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {drama.episodeCount > episodeList.length && (
              <Link
                href={`/drama/${drama.slug}`}
                className="mt-3 block text-center text-xs font-semibold text-[var(--slop-violet)]"
              >
                All {drama.episodeCount} episodes
              </Link>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white/45">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]">
            <Keyboard className="h-3.5 w-3.5" />
            Desktop tips
          </p>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed">
            <li className="flex items-center gap-2">
              <span className="inline-flex items-center gap-0.5 rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] text-white/70">
                <ChevronUp className="h-3 w-3" />
                <ChevronDown className="h-3 w-3" />
              </span>
              Scroll or drag to change episodes
            </li>
            <li>Click the player to pause · mute from the rail</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-black">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--slop-violet)]" />
        </div>
      }
    >
      <WatchInner />
    </Suspense>
  );
}
