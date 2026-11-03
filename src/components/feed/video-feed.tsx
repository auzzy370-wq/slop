"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getFeed } from "@/lib/feed";
import {
  readHiddenDramaIds,
  subscribeHiddenDramas,
} from "@/lib/hidden-series";
import { hardStopFeedPlayback } from "@/lib/media-silence";
import { getGuestActorId } from "@/lib/social/guest";
import type { FeedSection } from "@/lib/types";
import { useSlopStore } from "@/store/slop-store";
import { watchHref } from "@/lib/watch-url";
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
  focusVideoId,
  onActiveVideoChange,
}: {
  section?: FeedSection;
  categoryId?: string;
  query?: string;
  startVideoId?: string;
  /** Jump to this episode without a route change (desktop episode rail). */
  focusVideoId?: string | null;
  onActiveVideoChange?: (videoId: string) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const feedParam = (searchParams.get("feed") as FeedSection | null) ?? section;
  const partyRoom = searchParams.get("party");
  const videos = useSlopStore((s) => s.videos);
  const categories = useSlopStore((s) => s.categories);
  const dramas = useSlopStore((s) => s.dramas);
  const saves = useSlopStore((s) => s.saves);
  const user = useSlopStore((s) => s.currentUser);
  const settings = useSlopStore((s) => s.settings);
  const hydrated = useSlopStore((s) => s.hydrated);
  const blobPlaybackBlocked = useSlopStore((s) => s.blobPlaybackBlocked);

  const [activeIndex, setActiveIndex] = useState(0);
  // Desktop Chrome/Firefox block unmuted autoplay — start muted so PC plays.
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [pageH, setPageH] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("slop-volume");
      if (raw == null) return;
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0 && n <= 1) setVolume(n);
    } catch {
      /* ignore */
    }
  }, []);

  // Leaving /watch must kill any in-flight audio (incl. PiP leftovers).
  useEffect(() => {
    return () => {
      hardStopFeedPlayback();
    };
  }, []);

  const persistVolume = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(1, Math.round(next * 100) / 100));
    setVolume(clamped);
    try {
      localStorage.setItem("slop-volume", String(clamped));
    } catch {
      /* ignore */
    }
    if (clamped <= 0) setMuted(true);
    else setMuted(false);
  }, []);
  /** Hide live video during swipe so poster track can peek through. */
  const [peeking, setPeeking] = useState(false);
  /** Reactive PiP flag — `document.pictureInPictureElement` alone won't re-render. */
  const [pipActive, setPipActive] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const pageHRef = useRef(0);
  const pipActiveRef = useRef(false);
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
  const peekingRef = useRef(false);
  const wheelLockRef = useRef(0);
  const rafDragRef = useRef(0);
  const pendingYRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const lastVideoIdRef = useRef<string | null>(null);
  const lastStartIdRef = useRef<string | undefined>(undefined);
  const animTimerRef = useRef<number | null>(null);

  const savedIds = useMemo(() => {
    const actorId = user?.id ?? getGuestActorId();
    return saves
      .filter((s) => s.userId === actorId)
      .map((s) => s.videoId);
  }, [saves, user]);

  const [hiddenDramaIds, setHiddenDramaIds] = useState<string[]>([]);
  useEffect(() => {
    const syncHidden = () => setHiddenDramaIds(readHiddenDramaIds());
    syncHidden();
    return subscribeHiddenDramas(syncHidden);
  }, []);

  const feedVideos = useMemo(() => {
    const effectiveSection =
      section === "for-you" && feedParam ? feedParam : section;
    return getFeed(videos, effectiveSection, {
      categoryId,
      query,
      savedIds,
      hideUnplayableBlob: blobPlaybackBlocked,
      hiddenDramaIds,
    });
  }, [
    videos,
    section,
    feedParam,
    categoryId,
    query,
    savedIds,
    blobPlaybackBlocked,
    hiddenDramaIds,
  ]);

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
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Keep a reactive PiP flag so ad slides can't unmount the live <video>.
  // Includes Document PiP (`documentPictureInPicture.window`), which does not
  // fire the classic video enter/leavepictureinpicture events.
  useEffect(() => {
    if (typeof document === "undefined") return;
    type Dpi = {
      window: Window | null;
      addEventListener: (type: "enter", listener: (ev: Event & { window?: Window }) => void) => void;
      removeEventListener: (type: "enter", listener: (ev: Event & { window?: Window }) => void) => void;
    };
    const dpi = (
      window as Window & { documentPictureInPicture?: Dpi }
    ).documentPictureInPicture;

    const sync = () => {
      const on = !!(document.pictureInPictureElement || dpi?.window);
      pipActiveRef.current = on;
      setPipActive(on);
    };
    sync();

    const onDocEnter = (ev: Event & { window?: Window }) => {
      sync();
      ev.window?.addEventListener("pagehide", sync);
    };

    document.addEventListener("enterpictureinpicture", sync, true);
    document.addEventListener("leavepictureinpicture", sync, true);
    dpi?.addEventListener("enter", onDocEnter);
    return () => {
      document.removeEventListener("enterpictureinpicture", sync, true);
      document.removeEventListener("leavepictureinpicture", sync, true);
      dpi?.removeEventListener("enter", onDocEnter);
    };
  }, []);

  const onCardPipChange = useCallback((active: boolean) => {
    if (active) {
      pipActiveRef.current = true;
      setPipActive(true);
      return;
    }
    const dpi = (
      window as Window & { documentPictureInPicture?: { window: Window | null } }
    ).documentPictureInPicture;
    const on = !!(document.pictureInPictureElement || dpi?.window);
    pipActiveRef.current = on;
    setPipActive(on);
  }, []);

  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return pageHRef.current || 1;
    const parent = el.parentElement;
    // Stage box is source of truth. Never size slides from window.innerHeight —
    // that disagrees with the absolute stage on iOS (URL chrome / PiP) and
    // shows two reels at once around ad breaks.
    const rectH = Math.round(
      (parent ?? el).getBoundingClientRect().height,
    );
    const fromParent = parent?.clientHeight ?? 0;
    const fromSelf = el.clientHeight;
    const h = Math.round(
      (rectH > 40 ? rectH : 0) ||
        (fromParent > 40 ? fromParent : 0) ||
        (fromSelf > 40 ? fromSelf : 0) ||
        window.visualViewport?.height ||
        window.innerHeight ||
        1,
    );
    pageHRef.current = h;
    // Avoid redundant setState — ResizeObserver + height writes can otherwise
    // thrash into "Maximum update depth exceeded" on share landings.
    setPageH((prev) => (prev === h ? prev : h));
    el.style.setProperty("--slop-feed-page", `${h}px`);
    // Keep scroller locked to the stage; clear any prior inline height mismatch.
    el.style.height = `${h}px`;
    el.style.maxHeight = `${h}px`;
    return h;
  }, []);

  // Poster track may use GPU transforms — the live <video> is a sibling layer,
  // not a descendant, so Chrome desktop still paints frames.
  const applyOffset = useCallback((y: number, animate: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.top = "0px";
    track.style.transition = animate
      ? `transform ${PAGE_MS}ms cubic-bezier(0.2, 0.85, 0.25, 1)`
      : "none";
    track.style.transform = `translate3d(0, ${y}px, 0)`;
  }, []);

  const endPeek = useCallback(() => {
    peekingRef.current = false;
    setPeeking(false);
  }, []);

  const goTo = useCallback(
    (idx: number, animate = true) => {
      const h = measure();
      let clamped = Math.max(0, Math.min(itemsLenRef.current - 1, idx));
      // PiP is tied to one <video> node — landing on an ad unmounts it and
      // closes the window. Skip ad slides while picture-in-picture is open.
      if (pipActiveRef.current) {
        const list = itemsRef.current;
        if (list[clamped]?.kind === "ad") {
          const dir = clamped >= indexRef.current ? 1 : -1;
          let found = -1;
          for (let i = clamped; i >= 0 && i < list.length; i += dir) {
            if (list[i]?.kind === "video") {
              found = i;
              break;
            }
          }
          if (found < 0) {
            for (let i = clamped; i >= 0 && i < list.length; i -= dir) {
              if (list[i]?.kind === "video") {
                found = i;
                break;
              }
            }
          }
          if (found < 0) return;
          clamped = found;
        }
      }
      indexRef.current = clamped;
      setActiveIndex(clamped);
      if (animTimerRef.current) {
        window.clearTimeout(animTimerRef.current);
        animTimerRef.current = null;
      }
      animatingRef.current = animate;
      if (animate) {
        peekingRef.current = true;
        setPeeking(true);
      }
      applyOffset(-clamped * h, animate);
      if (animate) {
        animTimerRef.current = window.setTimeout(() => {
          animatingRef.current = false;
          animTimerRef.current = null;
          const nextH = measure();
          applyOffset(-indexRef.current * nextH, false);
          endPeek();
        }, PAGE_MS + 20);
      } else {
        animatingRef.current = false;
        endPeek();
      }
    },
    [applyOffset, endPeek, measure],
  );

  // Remember the episode under the active index so ad inserts can't desync paging.
  useEffect(() => {
    const item = items[activeIndex];
    if (item?.kind === "video") lastVideoIdRef.current = item.videoId;
  }, [items, activeIndex]);

  // Measure + keep the active episode in sync.
  // - First mount / startVideoId change (desktop episode rail) → jump to that EP
  // - items.length change (ads inject) → stay on the episode already on screen
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    measure();
    let start = indexRef.current;
    const startChanged =
      Boolean(startVideoId) && startVideoId !== lastStartIdRef.current;

    if (!startedRef.current || startChanged) {
      start = 0;
      if (startVideoId) {
        const idx = items.findIndex(
          (item) => item.kind === "video" && item.videoId === startVideoId,
        );
        if (idx >= 0) start = idx;
      }
      startedRef.current = true;
      lastStartIdRef.current = startVideoId;
    } else {
      const prefer = lastVideoIdRef.current;
      if (prefer) {
        const idx = items.findIndex(
          (item) => item.kind === "video" && item.videoId === prefer,
        );
        if (idx >= 0) start = idx;
      }
      start = Math.max(0, Math.min(items.length - 1, start));
    }

    indexRef.current = start;
    setActiveIndex(start);
    const startItem = items[start];
    if (startItem?.kind === "video") {
      lastVideoIdRef.current = startItem.videoId;
    }
    requestAnimationFrame(() => goTo(start, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid re-paging on every items rebuild
  }, [hydrated, startVideoId, items.length]);

  // Resize / visualViewport keeps the current page locked (iOS chrome + PiP).
  useEffect(() => {
    if (!hydrated) return;
    const onResize = () => {
      if (animatingRef.current) return;
      measure();
      goTo(indexRef.current, false);
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);
    const parent = viewportRef.current?.parentElement;
    const ro =
      parent && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(onResize)
        : null;
    if (parent && ro) ro.observe(parent);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
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
    applyOffset(y, false);
  }, [applyOffset]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (animatingRef.current) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        "button, a, input, textarea, [role='slider'], [role='dialog'], [data-no-swipe], [data-sheet-scroll], .slop-comments-sheet",
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

    if (!peekingRef.current) {
      peekingRef.current = true;
      setPeeking(true);
    }

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

    if (!drag.dragging) {
      endPeek();
      return;
    }

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
    // Let sheets / lists (comments, episodes, etc.) scroll instead of paging.
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        "[data-no-swipe], [data-sheet-scroll], [role='dialog'], .slop-comments-sheet",
      )
    ) {
      return;
    }
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
        lastVideoIdRef.current = videoId;
        goTo(idx, true);
        onActiveVideoChange?.(videoId);
        return;
      }
      const target = videos.find((v) => v.id === videoId);
      if (!target) return;
      const drama = dramas.find((d) => d.id === target.dramaId);
      router.push(
        watchHref({
          episodeId: target.id,
          dramaId: target.dramaId,
          dramaSlug: drama?.slug,
        }),
      );
    },
    [items, goTo, videos, dramas, router, onActiveVideoChange],
  );

  // Desktop episode rail — jump in-place, no route replace (that remounted the player).
  const lastFocusRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!focusVideoId || focusVideoId === lastFocusRef.current) return;
    lastFocusRef.current = focusVideoId;
    const idx = items.findIndex(
      (item) => item.kind === "video" && item.videoId === focusVideoId,
    );
    if (idx < 0) return;
    lastVideoIdRef.current = focusVideoId;
    goTo(idx, true);
  }, [focusVideoId, items, goTo]);

  // Notify parent of the active episode for desktop rail highlighting.
  useEffect(() => {
    const item = items[activeIndex];
    if (item?.kind === "video") onActiveVideoChange?.(item.videoId);
  }, [activeIndex, items, onActiveVideoChange]);

  const onEpisodeEnded = useCallback(() => {
    const current = indexRef.current;
    // PiP is tied to one <video> node — remounting onto an ad slide exits it.
    // Always advance to the next real episode (prefer same series).
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
    for (let i = current + 1; i < itemsLenRef.current; i++) {
      if (items[i]?.kind === "video") {
        goTo(i, true);
        return;
      }
    }
  }, [items, videos, goTo]);

  // If an ad becomes active while PiP is open, jump to the next episode so
  // the picture-in-picture window isn't torn down by swapping to AdSlot.
  useEffect(() => {
    if (!pipActive) return;
    if (items[activeIndex]?.kind !== "ad") return;
    for (let i = activeIndex + 1; i < items.length; i++) {
      if (items[i]?.kind === "video") {
        goTo(i, false);
        return;
      }
    }
    for (let i = activeIndex - 1; i >= 0; i--) {
      if (items[i]?.kind === "video") {
        goTo(i, false);
        return;
      }
    }
  }, [activeIndex, items, goTo, pipActive]);

  const onPlaybackFailed = useCallback(() => {
    const current = indexRef.current;
    if (current < itemsLenRef.current - 1) {
      window.setTimeout(() => goTo(current + 1, true), 350);
    }
  }, [goTo]);

  const onSkipAd = useCallback(() => {
    const current = indexRef.current;
    for (let i = current + 1; i < itemsLenRef.current; i++) {
      if (itemsRef.current[i]?.kind === "video") {
        goTo(i, true);
        return;
      }
    }
  }, [goTo]);

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

  const activeItem = items[activeIndex];
  const activeVideo =
    activeItem?.kind === "video"
      ? feedVideos.find((v) => v.id === activeItem.videoId)
      : undefined;
  // While PiP is open, never unmount the live player — even if we briefly land
  // on an ad index before the skip effect runs.
  const liveVideo =
    activeVideo ??
    (pipActive && lastVideoIdRef.current
      ? feedVideos.find((v) => v.id === lastVideoIdRef.current)
      : undefined);

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
      {/* Live player — sibling of the transformed track so Chrome paints frames. */}
      <div
        className={`slop-feed-live-layer${peeking ? " is-peeking" : ""}`}
        aria-hidden={peeking}
      >
        {activeItem?.kind === "ad" && !pipActive ? (
          <AdSlot index={activeIndex} onSkip={onSkipAd} />
        ) : liveVideo ? (
          <VideoCard
            // Stable key so episode advances reuse the same <video> node and
            // Picture-in-Picture can keep playing into the next episode.
            key="slop-live-player"
            video={liveVideo}
            active
            muted={muted || volume <= 0}
            volume={volume}
            onToggleMute={() => {
              if (muted || volume <= 0) {
                const restore = volume <= 0 ? 0.7 : volume;
                persistVolume(restore);
                setMuted(false);
              } else {
                setMuted(true);
              }
            }}
            onVolumeChange={persistVolume}
            categoryNames={liveVideo.categoryIds
              .map((id) => categoryNameMap[id])
              .filter(Boolean)}
            onJumpToVideo={onJumpToVideo}
            onEpisodeEnded={onEpisodeEnded}
            onPlaybackFailed={onPlaybackFailed}
            onPictureInPictureChange={onCardPipChange}
            partyRoomId={partyRoom}
          />
        ) : null}
      </div>

      {/* Poster / ad previews only — never mount <video> here. */}
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
                data-kind="ad"
              >
                {near ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#111116] text-sm text-white/50">
                    Ad
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-[#111116]" aria-hidden />
                )}
              </section>
            );
          }
          const video = feedVideos.find((v) => v.id === item.videoId)!;
          return (
            <section
              key={video.id}
              className="slop-feed-slide"
              data-index={index}
              data-kind="video"
            >
              <div
                className="h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${video.thumbnailUrl})` }}
                aria-hidden
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
