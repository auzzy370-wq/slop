"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  useEffect(() => {
    if (!startVideoId || !scrollerRef.current) return;
    const idx = items.findIndex(
      (item) => item.kind === "video" && item.videoId === startVideoId,
    );
    if (idx >= 0) {
      const child = scrollerRef.current.children[idx] as HTMLElement | undefined;
      child?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
      setActiveIndex(idx);
    }
  }, [startVideoId, items]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const nodes = Array.from(root.children);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const idx = nodes.indexOf(visible.target);
        if (idx >= 0) setActiveIndex(idx);
      },
      { root, threshold: [0.6, 0.75, 0.9] },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [items.length, hydrated]);

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
        <p className="font-display text-2xl text-white">
          Nothing here yet
        </p>
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
      className="h-[100dvh] snap-y snap-mandatory overflow-y-scroll overscroll-y-contain scrollbar-none"
    >
      {items.map((item, index) => {
        const near = Math.abs(index - activeIndex) <= 1;
        if (item.kind === "ad") {
          return (
            <section key={item.key} className="h-[100dvh] w-full shrink-0">
              <AdSlot index={index} />
            </section>
          );
        }
        const video = feedVideos.find((v) => v.id === item.videoId)!;
        return (
          <section key={video.id} className="h-[100dvh] w-full shrink-0">
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
