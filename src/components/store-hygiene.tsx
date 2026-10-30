"use client";

import { useEffect } from "react";
import {
  applyEngagementCounts,
  catalogFromSeed,
} from "@/lib/engagement";
import { useSlopStore } from "@/store/slop-store";

/**
 * One-shot: wipe legacy localStorage catalogs that baked in fake
 * 842K views / 32K likes, then re-derive counters from real rows only.
 */
export function StoreHygiene() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("slop-local-v") && key !== "slop-local-v6") {
        localStorage.removeItem(key);
      }
    }

    const state = useSlopStore.getState();
    const viewMap = new Map(
      state.videos.map((v) => [
        v.id,
        v.viewCount > 10_000 ? 0 : Math.max(0, v.viewCount),
      ] as const),
    );
    const catalog = catalogFromSeed(viewMap);
    const derived = applyEngagementCounts(
      catalog.videos,
      catalog.dramas,
      state.likes,
      state.saves,
      state.comments.filter((c) => !String(c.id).startsWith("cmt_")),
    );
    useSlopStore.setState({
      ...derived,
      comments: state.comments.filter((c) => !String(c.id).startsWith("cmt_")),
    });
  }, []);

  return null;
}
