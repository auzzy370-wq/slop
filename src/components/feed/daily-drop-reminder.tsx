"use client";

import { useEffect } from "react";
import { readContinueWatching } from "@/lib/continue-watching";
import {
  readDailyDropReminder,
  subscribeViewerPrefs,
} from "@/lib/viewer-prefs";
import { useSlopStore } from "@/store/slop-store";
import { watchHref } from "@/lib/watch-url";

const LAST_SHOWN_KEY = "slop-daily-drop-last";

function alreadyShownToday() {
  try {
    const raw = localStorage.getItem(LAST_SHOWN_KEY);
    if (!raw) return false;
    const day = new Date().toISOString().slice(0, 10);
    return raw === day;
  } catch {
    return false;
  }
}

function markShownToday() {
  try {
    localStorage.setItem(
      LAST_SHOWN_KEY,
      new Date().toISOString().slice(0, 10),
    );
  } catch {
    /* ignore */
  }
}

/**
 * When enabled, nudges once per day about a mid-series continue entry.
 * Uses the Notification API when permission is granted.
 */
export function DailyDropReminder() {
  const dramas = useSlopStore((s) => s.dramas);
  const videos = useSlopStore((s) => s.videos);
  const hydrated = useSlopStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;

    const run = async () => {
      if (!readDailyDropReminder()) return;
      if (alreadyShownToday()) return;
      if (typeof window === "undefined" || !("Notification" in window)) return;

      const entries = readContinueWatching().filter((e) => {
        const ratio =
          e.durationSec > 0 ? e.positionSec / e.durationSec : 0;
        return ratio > 0.05 && ratio < 0.92;
      });
      if (entries.length === 0) return;

      const top = entries[0];
      const drama = dramas.find((d) => d.id === top.dramaId);
      const ep = videos.find((v) => v.id === top.episodeId);
      if (!drama || !ep) return;

      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission !== "granted") return;

      const href = watchHref({
        episodeId: ep.id,
        dramaId: drama.id,
        dramaSlug: drama.slug,
      });
      const n = new Notification("Continue on SLOP", {
        body: `${drama.title} · Ep ${ep.episodeNumber} is waiting`,
        tag: "slop-daily-drop",
      });
      n.onclick = () => {
        window.focus();
        window.location.href = href;
        n.close();
      };
      markShownToday();
    };

    const t = window.setTimeout(() => {
      void run();
    }, 2500);
    const unsub = subscribeViewerPrefs(() => {
      void run();
    });
    return () => {
      window.clearTimeout(t);
      unsub();
    };
  }, [hydrated, dramas, videos]);

  return null;
}
