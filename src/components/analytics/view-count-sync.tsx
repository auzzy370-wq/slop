"use client";

import { useEffect } from "react";
import { useSlopStore } from "@/store/slop-store";

/**
 * Overwrites public view counters from recorded playback sessions.
 * Never invents traffic — if analytics has no plays, counts stay at seed 0
 * (plus any local increments from this device since last sync).
 */
export function ViewCountSync() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          "/api/analytics/summary?range=all_time&section=content",
        );
        if (!res.ok) return;
        const json = await res.json();
        const episodes: { episodeId: string; dramaId: string | null; plays: number }[] =
          json.episodes ?? [];
        if (cancelled || episodes.length === 0) return;

        const byEpisode = new Map(
          episodes.map((e) => [e.episodeId, e.plays] as const),
        );
        const byDrama = new Map<string, number>();
        for (const e of episodes) {
          if (!e.dramaId) continue;
          byDrama.set(e.dramaId, (byDrama.get(e.dramaId) ?? 0) + e.plays);
        }

        const state = useSlopStore.getState();
        useSlopStore.setState({
          videos: state.videos.map((v) => {
            const plays = byEpisode.get(v.id);
            if (plays == null) return v;
            // Prefer server truth when higher; keep local if user just watched
            return { ...v, viewCount: Math.max(v.viewCount, plays) };
          }),
          dramas: state.dramas.map((d) => {
            const plays = byDrama.get(d.id);
            if (plays == null) return d;
            return { ...d, viewCount: Math.max(d.viewCount, plays) };
          }),
        });
      } catch {
        // Offline / cold start — leave local counts
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
