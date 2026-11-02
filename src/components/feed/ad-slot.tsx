"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import { getAdsPublicConfig } from "@/lib/ads/config";
import { track } from "@/lib/analytics/client";
import { useSlopStore } from "@/store/slop-store";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function isAdsenseFilled(host: HTMLModElement | null): boolean {
  if (!host) return false;
  const status = host.getAttribute("data-adsbygoogle-status");
  const iframe = host.querySelector("iframe");
  const rect = iframe?.getBoundingClientRect();
  return (
    status === "done" &&
    !!iframe &&
    (rect?.height ?? 0) > 40 &&
    (rect?.width ?? 0) > 40 &&
    host.getAttribute("data-ad-status") !== "unfilled"
  );
}

/**
 * Full-bleed feed interstitial.
 *
 * When AdSense is configured we mount a fixed-size unit inside overflow:hidden
 * so Google’s iframe can’t resize the reel pager. If the unit doesn’t fill
 * (approval pending / no inventory), we fall back to the Premium house CTA.
 *
 * After a filled AdSense unit (or house CTA) has been shown for
 * `adSkipAfterSeconds`, Skip advances to the next episode.
 */
export function AdSlot({
  index,
  onSkip,
}: {
  index: number;
  onSkip?: () => void;
}) {
  const settings = useSlopStore((s) => s.settings);
  const ads = getAdsPublicConfig();
  const useAdsense = ads.provider === "adsense" && ads.configured;
  const skipAfter = Math.max(
    0,
    Math.min(30, Math.round(settings.adSkipAfterSeconds ?? 5)),
  );
  const [mode, setMode] = useState<"adsense" | "house">(
    useAdsense ? "adsense" : "house",
  );
  /** True once we're showing something skippable (filled AdSense or house). */
  const [readyToCount, setReadyToCount] = useState(!useAdsense);
  const [secondsLeft, setSecondsLeft] = useState(skipAfter);
  const [canSkip, setCanSkip] = useState(skipAfter <= 0);
  const pushed = useRef(false);
  const tracked = useRef(false);
  const completed = useRef(false);
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!settings.adsEnabled) return;
    if (!useAdsense || !ads.clientId || !ads.feedSlotId) {
      setMode("house");
      setReadyToCount(true);
      return;
    }
    if (pushed.current) return;
    pushed.current = true;

    const fallback = window.setTimeout(() => {
      if (isAdsenseFilled(insRef.current)) {
        setReadyToCount(true);
        return;
      }
      setMode("house");
      setReadyToCount(true);
    }, 3500);

    // Poll briefly so a fast fill starts the skip clock without waiting 3.5s.
    const poll = window.setInterval(() => {
      if (!isAdsenseFilled(insRef.current)) return;
      window.clearInterval(poll);
      window.clearTimeout(fallback);
      setReadyToCount(true);
    }, 400);

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      void track("advertisement_requested", {
        properties: {
          provider: "adsense",
          placement: "feed",
          index,
          slot: ads.feedSlotId,
        },
      });
    } catch {
      setMode("house");
      setReadyToCount(true);
    }

    return () => {
      window.clearTimeout(fallback);
      window.clearInterval(poll);
    };
  }, [
    settings.adsEnabled,
    useAdsense,
    ads.clientId,
    ads.feedSlotId,
    index,
  ]);

  useEffect(() => {
    if (tracked.current) return;
    if (!readyToCount) return;
    if (mode !== "house" && mode !== "adsense") return;
    tracked.current = true;
    void track("advertisement_displayed", {
      properties: {
        provider: mode === "adsense" ? "adsense" : "house",
        placement: "feed",
        index,
        filled: mode === "adsense",
      },
    });
  }, [mode, index, readyToCount]);

  // Countdown → enable Skip (and auto-advance) after N seconds on a filled break.
  useEffect(() => {
    if (!settings.adsEnabled || !readyToCount) return;
    setSecondsLeft(skipAfter);
    setCanSkip(skipAfter <= 0);
    if (skipAfter <= 0) return;

    const started = Date.now();
    const tick = window.setInterval(() => {
      const left = Math.max(
        0,
        skipAfter - Math.floor((Date.now() - started) / 1000),
      );
      setSecondsLeft(left);
      if (left <= 0) {
        setCanSkip(true);
        window.clearInterval(tick);
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [readyToCount, skipAfter, settings.adsEnabled, mode, index]);

  const skipForward = (reason: "manual" | "auto") => {
    if (completed.current) return;
    completed.current = true;
    void track("advertisement_completed", {
      properties: {
        provider: mode === "adsense" ? "adsense" : "house",
        placement: "feed",
        index,
        reason,
        skipAfter,
      },
    });
    onSkip?.();
  };

  // Auto-advance once Skip unlocks.
  useEffect(() => {
    if (!canSkip || !readyToCount || !onSkip) return;
    const t = window.setTimeout(() => skipForward("auto"), 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when unlocked
  }, [canSkip, readyToCount]);

  if (!settings.adsEnabled) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black text-sm text-white/50">
        Swipe for the next episode
      </div>
    );
  }

  const skipLabel = canSkip
    ? "Skip ad"
    : `Skip in ${secondsLeft}s`;

  const skipButton = (
    <button
      type="button"
      disabled={!canSkip}
      className="absolute bottom-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-md transition enabled:hover:bg-black/70 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
      onClick={() => {
        if (!canSkip) return;
        skipForward("manual");
      }}
    >
      {skipLabel}
    </button>
  );

  if (mode === "adsense" && ads.clientId && ads.feedSlotId) {
    return (
      <div
        className="absolute inset-0 overflow-hidden bg-[#111116]"
        data-ad-slot="adsense"
      >
        <div className="absolute right-4 top-[max(1rem,calc(env(safe-area-inset-top)+3.25rem))] z-10 rounded-md border border-white/20 bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
          Advertisement
        </div>
        {/* Fixed stage — never let the ad iframe grow the feed slide */}
        <div className="flex h-full w-full items-center justify-center overflow-hidden p-3 pt-[max(3.5rem,calc(env(safe-area-inset-top)+2.5rem))] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="relative h-full max-h-full w-full max-w-lg overflow-hidden rounded-2xl bg-black/40">
            <ins
              ref={insRef}
              className="adsbygoogle"
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                minHeight: "280px",
              }}
              data-ad-client={ads.clientId}
              data-ad-slot={ads.feedSlotId}
              data-ad-format="auto"
              data-full-width-responsive="true"
              {...(ads.testMode ? { "data-adtest": "on" } : {})}
            />
          </div>
        </div>
        {skipButton}
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,_#1c1630_0%,_#111116_55%)] px-6 text-center"
      data-ad-slot="house"
    >
      <div className="absolute right-4 top-[max(1rem,calc(env(safe-area-inset-top)+3.25rem))] rounded-md border border-white/20 bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
        Advertisement
      </div>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--slop-violet)]/15 text-[var(--slop-violet)]">
        <Megaphone className="h-7 w-7" />
      </div>
      <p className="mb-2 font-display text-2xl text-white">
        Keep watching without ads
      </p>
      <p className="mb-6 max-w-sm text-sm text-white/65">
        {useAdsense
          ? "No ad filled this break yet (AdSense inventory / approval). Premium skips breaks entirely."
          : `Free viewers see a short break between episodes (#${index + 1}). Premium removes them completely.`}
      </p>
      <Link
        href="/premium"
        onClick={() => {
          void track("advertisement_clicked", {
            properties: { provider: "house", placement: "feed", index },
          });
        }}
        className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--slop-violet)] px-5 text-sm font-semibold text-[var(--slop-black)] transition hover:brightness-110"
      >
        Go ad-free for {settings.premiumPriceLabel}
      </Link>
      {skipButton}
    </div>
  );
}
