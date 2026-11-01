"use client";

import { useEffect } from "react";
import {
  applyEngagementCounts,
  catalogFromSeed,
} from "@/lib/engagement";
import {
  mergeSeedWithUploads,
  type UploadsCatalog,
} from "@/lib/uploads-catalog-shared";
import { useSlopStore } from "@/store/slop-store";

/**
 * Wipe legacy poisoned catalogs, reset to seed, then re-apply any
 * admin mass-upload overlay from the server so uploads stick.
 */
export function StoreHygiene() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("slop-local-v") && key !== "slop-local-v8") {
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
      state.comments,
    );
    useSlopStore.setState({
      ...derived,
      comments: state.comments,
    });

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/catalog/uploads", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const uploads = (await res.json()) as UploadsCatalog;
        if (!uploads?.videos?.length && !uploads?.dramas?.length) return;

        const live = useSlopStore.getState();
        const merged = mergeSeedWithUploads(
          live.videos,
          live.dramas,
          uploads,
        );
        const withEngagement = applyEngagementCounts(
          merged.videos,
          merged.dramas,
          live.likes,
          live.saves,
          live.comments,
        );
        if (cancelled) return;
        useSlopStore.setState(withEngagement);
      } catch {
        /* seed-only is fine */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
