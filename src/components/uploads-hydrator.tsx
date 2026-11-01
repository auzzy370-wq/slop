"use client";

import { useEffect } from "react";
import { applyEngagementCounts } from "@/lib/engagement";
import type { Drama, Video } from "@/lib/types";
import { mergeSeedWithUploads, type UploadsCatalog } from "@/lib/uploads-catalog-shared";
import { useSlopStore } from "@/store/slop-store";

/**
 * After seed catalog / store hygiene, pull admin mass-upload overlay from the
 * server and merge it in so uploaded episodes stick across refresh & devices.
 */
export function UploadsHydrator() {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch("/api/catalog/uploads", { cache: "no-store" });
        if (!res.ok) return;
        const catalog = (await res.json()) as UploadsCatalog;
        if (cancelled) return;
        if (!catalog?.videos?.length && !catalog?.dramas?.length) return;

        const state = useSlopStore.getState();
        const merged = mergeSeedWithUploads(
          state.videos,
          state.dramas,
          catalog,
        );
        const derived = applyEngagementCounts(
          merged.videos,
          merged.dramas,
          state.likes,
          state.saves,
          state.comments,
        );
        useSlopStore.setState({
          videos: derived.videos as Video[],
          dramas: derived.dramas as Drama[],
        });
      } catch {
        /* keep seed catalog */
      }
    };

    // Run after StoreHygiene's one-shot reset.
    const t = window.setTimeout(() => {
      void run();
    }, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  return null;
}
