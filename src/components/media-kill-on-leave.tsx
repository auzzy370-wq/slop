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
    const kill = () => {
      if (isWatchPath(window.location.pathname)) {
        // Still on watch — only tear down when the document is being discarded.
        return;
      }
      hardStopFeedPlayback();
    };

    const onPageHide = () => hardStopFeedPlayback();
    const onPageShow = (e: PageTransitionEvent) => {
      // bfcache restore of a prior watch session can resume a <video>.
      if (e.persisted) hardStopFeedPlayback();
    };

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", kill);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", kill);
    };
  }, []);

  return null;
}
