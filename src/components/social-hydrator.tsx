"use client";

import { useEffect } from "react";
import { applyEngagementCounts } from "@/lib/engagement";
import { fetchSharedEngagement } from "@/lib/social/engagement-client";
import { useSlopStore } from "@/store/slop-store";

/**
 * Pull shared likes/comments from the server so every viewer sees the same
 * engagement — including guests with no account.
 */
export function SocialHydrator() {
  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const pull = async () => {
      const payload = await fetchSharedEngagement();
      if (!payload || cancelled) return;
      const live = useSlopStore.getState();
      const likes = payload.likes ?? [];
      const comments = payload.comments ?? [];
      const derived = applyEngagementCounts(
        live.videos,
        live.dramas,
        likes,
        live.saves,
        comments,
      );
      if (cancelled) return;
      useSlopStore.setState({
        ...derived,
        likes,
        comments,
      });
    };

    void pull();
    // Soft refresh so other viewers' likes/comments show up without reload.
    timer = window.setInterval(() => {
      void pull();
    }, 45_000);

    const onFocus = () => {
      void pull();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}
