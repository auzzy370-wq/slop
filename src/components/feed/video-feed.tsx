"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getFeed } from "@/lib/feed";
import type { FeedSection } from "@/lib/types";
import { useSlopStore } from "@/store/slop-store";
import { AdSlot } from "./ad-slot";
import { VideoCard } from "./video-card";

type FeedItem =
  | { kind: "video"; videoId: string }
  | { kind: "ad"; key: string };

const SWIPE_DISTANCE = 56;
const SWIPE_VELOCITY = 0.45; // px/ms
const MAX_RUBBER = 72;

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
  const searchParams = useSearchParams();
  const feedParam = (searchParams.get("feed") as FeedSection | null) ?? section;
  const videos = useSlopStore((s) => s.videos);
  const categories = useSlopStore((s) => s.categories);
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
    const h = Math.round(
      window.visualViewport?.height ||
        viewportRef.current?.clientHeight ||
        window.innerHeight ||
        1,
    );
    pageHRef.current = h;
    setPageH(h);
    if (viewportRef.current) {
      viewportRef.current.style.setProperty("--slop-feed-page", `${h}px`);
      viewportRef.current.style.height = `${h}px`;
    }
    return h;
  }, []);

  const applyTransform = useCallback((y: number, animate: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animate
      ? "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)"
      : "none";
    track.style.transform = `translate3d(0, ${y}px, 0)`;
  }, []);

  const goTo = useCallback(
    (idx: number, animate = true) => {
      const h = pageHRef.current || measure();
      const clamped = Math.max(0, Math.min(itemsLenRef.current - 1, idx));
      indexRef.current = clamped;
      setActiveIndex(clamped);
      animatingRef.current = animate;
      applyTransform(-clamped * h, animate);
      if (animate) {
        window.setTimeout(() => {
          animatingRef.current = false;
        }, 300);
      }
    },
    [applyTransform, measure],
  );

  // Initial measure + start episode
  useEffect(() => {
    if (!hydrated) return;
    measure();
    let start = 0;
    if (startVideoId) {
      const idx = items.findIndex(
        (item) => item.kind === "video" && item.videoId === startVideoId,
      );
      if (idx >= 0) start = idx;
    }
    indexRef.current = start;
    setActiveIndex(start);
    requestAnimationFrame(() => goTo(start, false));
  }, [hydrated, items, startVideoId, goTo, measure]);

  // Resize keeps the current page locked
  useEffect(() => {
    if (!hydrated) return;
    const onResize = () => {
      measure();
      goTo(indexRef.current, false);
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [hydrated, goTo, measure]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (animatingRef.current) return;
    // Don't hijack scrubber / buttons / links.
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea, [role='slider'], [data-no-swipe]")) {
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
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      // Vertical wins ties — this is a vertical pager.
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
    // Rubber-band at ends
    if (
      (indexRef.current === 0 && dy > 0) ||
      (indexRef.current >= itemsLenRef.current - 1 && dy < 0)
    ) {
      offset = Math.sign(dy) * Math.min(Math.abs(dy) * 0.35, MAX_RUBBER);
    }
    applyTransform(base + offset, false);
  };

  const finishDrag = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;

    if (!drag.dragging) return;

    const dy = e.clientY - drag.startY;
    const dt = Math.max(16, e.timeStamp - drag.startT);
    const instantDt = Math.max(16, e.timeStamp - drag.lastT);
    const instantDy = e.clientY - drag.lastY;
    const velocity = instantDy / instantDt; // px/ms, negative = swipe up = next

    let next = indexRef.current;
    const goNext =
      dy < -SWIPE_DISTANCE || velocity < -SWIPE_VELOCITY;
    const goPrev =
      dy > SWIPE_DISTANCE || velocity > SWIPE_VELOCITY;

    if (goNext) next = indexRef.current + 1;
    else if (goPrev) next = indexRef.current - 1;

    goTo(next, true);
  };

  const onWheel = (e: React.WheelEvent) => {
    // Desktop / trackpad paging
    if (Math.abs(e.deltaY) < 8) return;
    e.preventDefault();
    const now = Date.now();
    if (now - wheelLockRef.current < 420 || animatingRef.current) return;
    wheelLockRef.current = now;
    if (e.deltaY > 0) goTo(indexRef.current + 1, true);
    else goTo(indexRef.current - 1, true);
  };

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
          // ±1 is enough — Safari only reliably decodes one video at a time.
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
