"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getFeed } from "@/lib/feed";
import type { FeedSection } from "@/lib/types";
import { useSlopStore } from "@/store/slop-store";
import { AdSlot } from "./ad-slot";
import { VideoCard } from "./video-card";

type FeedItem =
  | { kind: "video"; videoId: string }
  | { kind: "ad"; key: string };

const SWIPE_DISTANCE = 42;
const SWIPE_VELOCITY = 0.28; // px/ms
const MAX_RUBBER = 56;
const PAGE_MS = 220;
const WHEEL_LOCK_MS = 260;

export function VideoFeed({
  section = "for-you",
  categoryId,
  query,
  startVideoId,
}: {
  section?: FeedSection;
  categoryId?: string;
  query?: string;
  startVideoId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const feedParam = (searchParams.get("feed") as FeedSection | null) ?? section;
  const videos = useSlopStore((s) => s.videos);
  const categories = useSlopStore((s) => s.categories);
  const dramas = useSlopStore((s) => s.dramas);
  const saves = useSlopStore((s) => s.saves);
  const user = useSlopStore((s) => s.currentUser);
  const settings = useSlopStore((s) => s.settings);
  const hydrated = useSlopStore((s) => s.hydrated);

  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [pageH, setPageH] = useState(0);

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const pageHRef = useRef(0);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startT: number;
    lastY: number;
    lastT: number;
    dragging: boolean;
    axis: "undecided" | "y" | "x";
  } | null>(null);
  const animatingRef = useRef(false);
  const wheelLockRef = useRef(0);
  const rafDragRef = useRef(0);
  const pendingYRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const animTimerRef = useRef<number | null>(null);

  const savedIds = useMemo(
    () =>
      user
        ? saves.filter((s) => s.userId === user.id).map((s) => s.videoId)
        : [],
    [saves, user],
  );

  const feedVideos = useMemo(() => {
    const effectiveSection =
      section === "for-you" && feedParam ? feedParam : section;
    return getFeed(videos, effectiveSection, {
      categoryId,
      query,
      savedIds,
    });
  }, [videos, section, feedParam, categoryId, query, savedIds]);

  const showAds =
    settings.adsEnabled && !(user?.isPremium && user.status === "active");

  const items: FeedItem[] = useMemo(() => {
    const out: FeedItem[] = [];
    let adCount = 0;
    feedVideos.forEach((video, index) => {
      out.push({ kind: "video", videoId: video.id });
      if (
        showAds &&
        settings.adPlacementEvery > 0 &&
        (index + 1) % settings.adPlacementEvery === 0
      ) {
        out.push({ kind: "ad", key: `ad_${adCount++}` });
      }
    });
    return out;
  }, [feedVideos, showAds, settings.adPlacementEvery]);

  const itemsLenRef = useRef(items.length);
  itemsLenRef.current = items.length;

  const measure = useCallback(() => {
    const el = viewportRef.current;
    const parent = el?.parentElement;
    const fromParent = parent?.clientHeight ?? 0;
    const fromSelf = el?.clientHeight ?? 0;
    const fromVv = window.visualViewport?.height ?? 0;
    // Take the largest candidate so a short svh parent can't leave a
    // black band under the slide when the browser chrome collapses.
    const h = Math.round(
      Math.max(
        fromParent > 40 ? fromParent : 0,
        fromSelf > 40 ? fromSelf : 0,
        fromVv,
        window.innerHeight || 0,
      ) || 1,
    );
    pageHRef.current = h;
    // Avoid redundant setState — ResizeObserver + height writes can otherwise
    // thrash into "Maximum update depth exceeded" on share landings.
    setPageH((prev) => (prev === h ? prev : h));
    if (el) {
      el.style.setProperty("--slop-feed-page", `${h}px`);
      el.style.height = `${h}px`;
    }
    return h;
  }, []);

  const applyTransform = useCallback((y: number, animate: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    if (animate) {
      track.style.transition = `transform ${PAGE_MS}ms cubic-bezier(0.2, 0.85, 0.25, 1)`;
    } else {
      track.style.transition = "none";
    }
    track.style.transform = `translate3d(0, ${y}px, 0)`;
  }, []);

  const goTo = useCallback(
    (idx: number, animate = true) => {
      const h = pageHRef.current || measure();
      const clamped = Math.max(0, Math.min(itemsLenRef.current - 1, idx));
      indexRef.current = clamped;
      setActiveIndex(clamped);
      if (animTimerRef.current) {
        window.clearTimeout(animTimerRef.current);
        animTimerRef.current = null;
      }
      animatingRef.current = animate;
      applyTransform(-clamped * h, animate);
      if (animate) {
        animTimerRef.current = window.setTimeout(() => {
          animatingRef.current = false;
          animTimerRef.current = null;
        }, PAGE_MS + 20);
      } else {
        animatingRef.current = false;
      }
    },
    [applyTransform, measure],
  );

  // Initial measure + start episode (once hydrated / when start id changes)
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    measure();
    let start = indexRef.current;
    if (!startedRef.current || startVideoId) {
      start = 0;
      if (startVideoId) {
        const idx = items.findIndex(
          (item) => item.kind === "video" && item.videoId === startVideoId,
        );
        if (idx >= 0) start = idx;
      }
      startedRef.current = true;
    }
    // Clamp if feed shrank
    start = Math.max(0, Math.min(items.length - 1, start));
    indexRef.current = start;
    setActiveIndex(start);
    requestAnimationFrame(() => goTo(start, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid re-paging on every items rebuild
  }, [hydrated, startVideoId, items.length]);

  // Resize keeps the current page locked
  useEffect(() => {
    if (!hydrated) return;
    const onResize = () => {
      measure();
      goTo(indexRef.current, false);
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    const parent = viewportRef.current?.parentElement;
    const ro =
      parent && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(onResize)
        : null;
    if (parent && ro) ro.observe(parent);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [hydrated, goTo, measure]);

  useEffect(() => {
    if (!hydrated) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowDown" || e.key === "j" || e.key === "PageDown") {
        e.preventDefault();
        goTo(indexRef.current + 1, true);
      } else if (e.key === "ArrowUp" || e.key === "k" || e.key === "PageUp") {
        e.preventDefault();
        goTo(indexRef.current - 1, true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hydrated, goTo]);

  const flushDragFrame = useCallback(() => {
    rafDragRef.current = 0;
    const y = pendingYRef.current;
    if (y == null) return;
    pendingYRef.current = null;
    applyTransform(y, false);
  }, [applyTransform]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (animatingRef.current) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        "button, a, input, textarea, [role='slider'], [data-no-swipe]",
      )
    ) {
      return;
    }
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startT: e.timeStamp,
      lastY: e.clientY,
      lastT: e.timeStamp,
      dragging: false,
      axis: "undecided",
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dy = e.clientY - drag.startY;
    const dx = e.clientX - drag.startX;

    if (drag.axis === "undecided") {
      if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
      drag.axis = Math.abs(dy) >= Math.abs(dx) ? "y" : "x";
      if (drag.axis === "x") {
        dragRef.current = null;
        return;
      }
      drag.dragging = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }

    if (!drag.dragging) return;
    e.preventDefault();

    drag.lastY = e.clientY;
    drag.lastT = e.timeStamp;

    const h = pageHRef.current || measure();
    const base = -indexRef.current * h;
    let offset = dy;
    if (
      (indexRef.current === 0 && dy > 0) ||
      (indexRef.current >= itemsLenRef.current - 1 && dy < 0)
    ) {
      offset = Math.sign(dy) * Math.min(Math.abs(dy) * 0.32, MAX_RUBBER);
    }
    pendingYRef.current = base + offset;
    if (!rafDragRef.current) {
      rafDragRef.current = requestAnimationFrame(flushDragFrame);
    }
  };

  const finishDrag = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;

    if (rafDragRef.current) {
      cancelAnimationFrame(rafDragRef.current);
      rafDragRef.current = 0;
      flushDragFrame();
    }

    if (!drag.dragging) return;

    const dy = e.clientY - drag.startY;
    const instantDt = Math.max(12, e.timeStamp - drag.lastT);
    const instantDy = e.clientY - drag.lastY;
    const velocity = instantDy / instantDt;

    let next = indexRef.current;
    const goNext = dy < -SWIPE_DISTANCE || velocity < -SWIPE_VELOCITY;
    const goPrev = dy > SWIPE_DISTANCE || velocity > SWIPE_VELOCITY;

    if (goNext) next = indexRef.current + 1;
    else if (goPrev) next = indexRef.current - 1;

    goTo(next, true);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) < 6) return;
    e.preventDefault();
    const now = Date.now();
    if (now - wheelLockRef.current < WHEEL_LOCK_MS || animatingRef.current) {
      return;
    }
    wheelLockRef.current = now;
    if (e.deltaY > 0) goTo(indexRef.current + 1, true);
    else goTo(indexRef.current - 1, true);
  };

  const onJumpToVideo = useCallback(
    (videoId: string) => {
      const idx = items.findIndex(
        (item) => item.kind === "video" && item.videoId === videoId,
      );
      if (idx >= 0) {
        goTo(idx, true);
        return;
      }
      const target = videos.find((v) => v.id === videoId);
      if (!target) return;
      const drama = dramas.find((d) => d.id === target.dramaId);
      const params = new URLSearchParams();
      params.set("start", target.id);
      params.set("drama", target.dramaId);
      if (drama?.slug) params.set("dramaSlug", drama.slug);
      router.push(`/watch?${params.toString()}`);
    },
    [items, goTo, videos, dramas, router],
  );

  const onEpisodeEnded = useCallback(() => {
    const current = indexRef.current;
    // Prefer the next episode of the same series when present in this feed.
    const currentItem = items[current];
    if (currentItem?.kind === "video") {
      const currentVideo = videos.find((v) => v.id === currentItem.videoId);
      if (currentVideo) {
        const nextSameSeries = items.findIndex((item, i) => {
          if (i <= current || item.kind !== "video") return false;
          const v = videos.find((x) => x.id === item.videoId);
          return (
            !!v &&
            v.dramaId === currentVideo.dramaId &&
            v.episodeNumber > currentVideo.episodeNumber
          );
        });
        if (nextSameSeries >= 0) {
          goTo(nextSameSeries, true);
          return;
        }
      }
    }
    if (current < itemsLenRef.current - 1) {
      goTo(current + 1, true);
    }
  }, [items, videos, goTo]);

  if (!hydrated) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[var(--slop-ink)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--slop-violet)]" />
      </div>
    );
  }

  if (feedVideos.length === 0) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-[var(--slop-ink)] px-6 text-center">
        <p className="font-display text-2xl text-white">Nothing here yet</p>
        <p className="max-w-sm text-sm text-white/60">
          {section === "saved"
            ? "Save videos from the feed to find them here later."
            : section === "search"
              ? "Try a different search term."
              : "Check back soon — new episodes are coming soon."}
        </p>
      </div>
    );
  }

  const categoryNameMap = Object.fromEntries(
    categories.map((c) => [c.id, c.name]),
  );

  return (
    <div
      ref={viewportRef}
      className="slop-feed-scroller"
      aria-label="Episode feed"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onWheel={onWheel}
    >
      <div
        ref={trackRef}
        className="slop-feed-track"
        style={{
          height: pageH ? pageH * items.length : undefined,
        }}
      >
        {items.map((item, index) => {
          const near = Math.abs(index - activeIndex) <= 1;
          if (item.kind === "ad") {
            return (
              <section
                key={item.key}
                className="slop-feed-slide"
                data-index={index}
              >
                <AdSlot index={index} />
              </section>
            );
          }
          const video = feedVideos.find((v) => v.id === item.videoId)!;
          return (
            <section
              key={video.id}
              className="slop-feed-slide"
              data-index={index}
            >
              {near ? (
                <VideoCard
                  video={video}
                  active={index === activeIndex}
                  muted={muted}
                  onToggleMute={() => setMuted((m) => !m)}
                  categoryNames={video.categoryIds
                    .map((id) => categoryNameMap[id])
                    .filter(Boolean)}
                  onJumpToVideo={onJumpToVideo}
                  onEpisodeEnded={onEpisodeEnded}
                />
              ) : (
                <div
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${video.thumbnailUrl})` }}
                />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
