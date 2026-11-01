"use client";

import { useEffect } from "react";
import { fetchSharedEngagement } from "@/lib/social/engagement-client";
import { useSlopStore } from "@/store/slop-store";

const REFRESH_EVENT = "slop:refresh-engagement";

/** Ask every SocialHydrator to re-pull shared likes/comments now. */
export function requestEngagementRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

/**
 * Pull shared likes/comments from the server so every viewer sees the same
 * engagement — including guests with no account.
 *
 * Waits for zustand rehydrate first so localStorage can't overwrite the pull.
 */
export function SocialHydrator() {
  const hydrated = useSlopStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    let timer: number | null = null;
    let inFlight = false;

    const pull = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        const payload = await fetchSharedEngagement();
        if (!payload || cancelled) return;
        useSlopStore.getState().mergeSharedEngagement({
          likes: payload.likes ?? [],
          comments: payload.comments ?? [],
        });
      } finally {
        inFlight = false;
      }
    };

    void pull();
    // Keep feeds in sync across devices without a full reload.
    timer = window.setInterval(() => {
      void pull();
    }, 12_000);

    const onFocus = () => {
      void pull();
    };
    const onRefresh = () => {
      void pull();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener(REFRESH_EVENT, onRefresh);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(REFRESH_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [hydrated]);

  return null;
}
