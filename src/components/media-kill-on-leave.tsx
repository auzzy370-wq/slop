"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { hardStopFeedPlayback } from "@/lib/media-silence";

function isWatchPath(path: string) {
  return path.startsWith("/watch") || path.startsWith("/v/");
}

/**
 * Guarantee feed audio dies when leaving Watch — click-away, router
 * transitions, and bfcache restores have all leaked playback before.
 */
export function MediaKillOnLeave() {
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  useEffect(() => {
    const prev = prevPath.current;
    prevPath.current = pathname;
    if (isWatchPath(prev) && !isWatchPath(pathname)) {
      hardStopFeedPlayback();
    }
  }, [pathname]);

  useEffect(() => {
    const killIfLeftWatch = () => {
      if (isWatchPath(window.location.pathname)) return;
      hardStopFeedPlayback();
    };

    const onPageHide = (e: PageTransitionEvent) => {
      // iOS FaceTime / call UI can fire pagehide without leaving Watch.
      // Destroying the <video> there keeps local audio recoverable after unmute
      // but permanently drops audio for FaceTime screen-share viewers.
      if (e.persisted) {
        hardStopFeedPlayback();
        return;
      }
      if (isWatchPath(window.location.pathname)) return;
      hardStopFeedPlayback();
    };

    const onPageShow = (e: PageTransitionEvent) => {
      // bfcache restore of a prior watch session can resume a <video>.
      if (e.persisted) hardStopFeedPlayback();
    };

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", killIfLeftWatch);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", killIfLeftWatch);
    };
  }, []);

  return null;
}
