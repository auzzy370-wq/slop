"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Play } from "lucide-react";
import { VideoFeed } from "@/components/feed/video-feed";
import { useSlopStore } from "@/store/slop-store";
import { formatCount } from "@/lib/utils";

function WatchInner() {
  const params = useSearchParams();
  const start = params.get("start") ?? undefined;
  const dramaParam = params.get("drama") ?? undefined;
  const dramaSlug = params.get("dramaSlug") ?? undefined;
  const feed = params.get("feed");

  const videos = useSlopStore((s) => s.videos);
  const dramas = useSlopStore((s) => s.dramas);
  const hydrated = useSlopStore((s) => s.hydrated);

  const [activeEpisodeId, setActiveEpisodeId] = useState<string | undefined>(
    start,
  );
  const [focusEpisodeId, setFocusEpisodeId] = useState<string | null>(null);

  // Prefer explicit drama id, then slug, then the start episode's series.
  const resolvedDramaId = useMemo(() => {
    if (!hydrated) return undefined;
    if (dramaParam) return dramaParam;
    if (dramaSlug) {
      const bySlug = dramas.find((d) => d.slug === dramaSlug);
      if (bySlug) return bySlug.id;
    }
    if (start) {
      const ep = videos.find((v) => v.id === start);
      if (ep?.dramaId) return ep.dramaId;
    }
    return undefined;
  }, [hydrated, dramaParam, dramaSlug, dramas, start, videos]);

  const seriesLocked = Boolean(resolvedDramaId);

  const startVideo = useMemo(() => {
    if (!hydrated) return undefined;
    if (start) {
      const hit = videos.find((v) => v.id === start);
      if (hit) return hit;
    }
    if (resolvedDramaId) {
      return videos
        .filter(
          (v) => v.dramaId === resolvedDramaId && v.status === "published",
        )
        .sort((a, b) => a.episodeNumber - b.episodeNumber)[0];
    }
    return videos.find((v) => v.status === "published");
  }, [hydrated, videos, start, resolvedDramaId]);

  useEffect(() => {
    if (start) setActiveEpisodeId(start);
    else if (startVideo?.id) setActiveEpisodeId(startVideo.id);
  }, [start, startVideo?.id]);

  const drama = useMemo(() => {
    if (resolvedDramaId) {
      return dramas.find((d) => d.id === resolvedDramaId);
    }
    if (dramaSlug) return dramas.find((d) => d.slug === dramaSlug);
    if (startVideo) return dramas.find((d) => d.id === startVideo.dramaId);
    return undefined;
  }, [dramas, resolvedDramaId, dramaSlug, startVideo]);

  const episodeList = useMemo(() => {
    if (!drama) return [];
    return videos
      .filter((v) => v.dramaId === drama.id && v.status === "published")
      .sort((a, b) => a.episodeNumber - b.episodeNumber);
  }, [videos, drama]);

  const backHref = drama
    ? `/drama/${drama.slug}`
    : dramaSlug
      ? `/drama/${dramaSlug}`
      : "/";

  const onActiveVideoChange = useCallback((videoId: string) => {
    setActiveEpisodeId(videoId);
  }, []);

  return (
    <div className="slop-watch-shell">
      {/* Mobile back control */}
      <Link
        href={backHref}
        className="fixed left-4 z-50 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur top-[max(1rem,env(safe-area-inset-top))] lg:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {/* Desktop left rail — series title only */}
      <aside className="hidden w-full max-w-xs justify-self-end lg:flex lg:flex-col lg:gap-4 lg:pr-2">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-white/60 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {drama ? "Back to series" : "Back home"}
        </Link>

        {drama ? (
          <div className="animate-fade">
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">
              {drama.title}
            </h1>
            <p className="mt-2 text-xs text-white/40">
              {drama.episodeCount} episodes
              {drama.viewCount > 0
                ? ` · ${formatCount(drama.viewCount)} views`
                : ""}
            </p>
          </div>
        ) : (
          <div className="animate-fade">
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">
              For you
            </h1>
            <p className="mt-2 text-sm text-white/45">Scroll for the next episode</p>
          </div>
        )}
      </aside>

      {/* Phone stage */}
      <div className="slop-watch-stage">
        <VideoFeed
          section={
            seriesLocked
              ? "drama"
              : feed === "trending"
                ? "trending"
                : "for-you"
          }
          categoryId={resolvedDramaId}
          startVideoId={start ?? startVideo?.id}
          focusVideoId={focusEpisodeId}
          onActiveVideoChange={onActiveVideoChange}
        />
      </div>

      {/* Desktop right rail — episode list only */}
      <aside className="hidden w-full max-w-[15rem] justify-self-start lg:flex lg:flex-col lg:pl-2">
        {episodeList.length > 0 && drama ? (
          <div className="animate-fade">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
              Episodes
            </p>
            <ul className="mt-3 max-h-[min(60vh,480px)] space-y-0.5 overflow-y-auto overscroll-contain pr-1">
              {episodeList.map((ep) => {
                const active = activeEpisodeId === ep.id;
                return (
                  <li key={ep.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveEpisodeId(ep.id);
                        setFocusEpisodeId(ep.id);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                        active
                          ? "bg-white/10 text-white"
                          : "text-white/55 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                          active
                            ? "bg-[var(--slop-violet)] text-[var(--slop-black)]"
                            : "bg-white/5 text-white/50"
                        }`}
                      >
                        {active ? (
                          <Play className="h-3 w-3 fill-current" />
                        ) : (
                          String(ep.episodeNumber).padStart(2, "0")
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                        {ep.title || `Episode ${ep.episodeNumber}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
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
