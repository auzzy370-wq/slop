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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const settlingRef = useRef(false);
  const scrollEndTimer = useRef<number | null>(null);

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

  const syncPageSize = useCallback(() => {
    const root = scrollerRef.current;
    if (!root) return 1;
    // Prefer visualViewport — matches what the user actually sees on iOS.
    const h = Math.round(
      window.visualViewport?.height || root.clientHeight || window.innerHeight || 1,
    );
    root.style.setProperty("--slop-feed-page", `${h}px`);
    // Keep the fixed scroller locked to the visual viewport height too.
    root.style.height = `${h}px`;
    return h;
  }, []);

  const pageHeight = useCallback(() => {
    const root = scrollerRef.current;
    if (!root) return window.innerHeight || 1;
    const raw = getComputedStyle(root).getPropertyValue("--slop-feed-page").trim();
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return syncPageSize();
  }, [syncPageSize]);

  const snapToIndex = useCallback(
    (idx: number, behavior: ScrollBehavior = "smooth") => {
      const root = scrollerRef.current;
      if (!root) return;
      const h = syncPageSize();
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const top = clamped * h;
      settlingRef.current = true;
      root.scrollTo({ top, behavior });
      setActiveIndex(clamped);
      window.setTimeout(
        () => {
          settlingRef.current = false;
        },
        behavior === "smooth" ? 280 : 40,
      );
    },
    [items.length, syncPageSize],
  );

  const nearestIndex = useCallback(() => {
    const root = scrollerRef.current;
    if (!root) return 0;
    const h = pageHeight();
    return Math.max(
      0,
      Math.min(items.length - 1, Math.round(root.scrollTop / h)),
    );
  }, [items.length, pageHeight]);

  /** Force settle onto a full slide — CSS snap alone can stall mid-card on iOS. */
  const settleSnap = useCallback(() => {
    if (settlingRef.current) return;
    const root = scrollerRef.current;
    if (!root) return;
    const h = pageHeight();
    const idx = nearestIndex();
    const target = idx * h;
    if (Math.abs(root.scrollTop - target) > 1.5) {
      snapToIndex(idx, "smooth");
    } else if (idx !== activeIndex) {
      setActiveIndex(idx);
    }
  }, [activeIndex, nearestIndex, pageHeight, snapToIndex]);

  useEffect(() => {
    syncPageSize();
    if (!startVideoId || !scrollerRef.current || items.length === 0) return;
    const idx = items.findIndex(
      (item) => item.kind === "video" && item.videoId === startVideoId,
    );
    if (idx >= 0) {
      requestAnimationFrame(() => snapToIndex(idx, "instant" as ScrollBehavior));
    }
  }, [startVideoId, items, snapToIndex, syncPageSize]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    syncPageSize();

    const onScroll = () => {
      if (settlingRef.current) return;
      const idx = nearestIndex();
      if (idx !== activeIndex) setActiveIndex(idx);
      if (scrollEndTimer.current) window.clearTimeout(scrollEndTimer.current);
      scrollEndTimer.current = window.setTimeout(settleSnap, 90);
    };

    const onScrollEnd = () => settleSnap();

    const onResize = () => {
      const idx = nearestIndex();
      syncPageSize();
      // Re-lock to the same episode after URL-bar / rotate resize.
      requestAnimationFrame(() =>
        snapToIndex(idx, "instant" as ScrollBehavior),
      );
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    root.addEventListener("scrollend", onScrollEnd);
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);

    return () => {
      root.removeEventListener("scroll", onScroll);
      root.removeEventListener("scrollend", onScrollEnd);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
      if (scrollEndTimer.current) window.clearTimeout(scrollEndTimer.current);
    };
  }, [
    activeIndex,
    items.length,
    nearestIndex,
    settleSnap,
    snapToIndex,
    syncPageSize,
    hydrated,
  ]);

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
      ref={scrollerRef}
      className="slop-feed-scroller"
      aria-label="Episode feed"
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
  );
}
