"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import { getAdsPublicConfig } from "@/lib/ads/config";
import { track } from "@/lib/analytics/client";
import { useSlopStore } from "@/store/slop-store";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

function HouseAd({ index }: { index: number }) {
  const settings = useSlopStore((s) => s.settings);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_#1c1630_0%,_#111116_55%)] px-6 text-center">
      <div className="absolute left-4 top-4 rounded-md border border-white/20 bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
        Advertisement
      </div>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--slop-violet)]/15 text-[var(--slop-violet)]">
        <Megaphone className="h-7 w-7" />
      </div>
      <p className="mb-2 font-display text-2xl text-white">
        Keep watching without ads
      </p>
      <p className="mb-6 max-w-sm text-sm text-white/65">
        Free viewers see a short break between episodes (#{index + 1}).
        Premium removes them completely.
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
    </div>
  );
}

/**
 * Full-bleed feed interstitial.
 * Always paints the house CTA so the reel pager never shows a blank half-slide
 * when AdSense has no fill. Network creative overlays only after a confirmed fill.
 */
export function AdSlot({ index }: { index: number }) {
  const ads = getAdsPublicConfig();
  const settings = useSlopStore((s) => s.settings);
  const pushed = useRef(false);
  const tracked = useRef(false);
  const [filled, setFilled] = useState(false);
  const reactId = useId();
  const slotDomId = `slop-ad-${reactId.replace(/:/g, "")}`;

  const useAdSense =
    ads.provider === "adsense" && Boolean(ads.clientId && ads.feedSlotId);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    void track("advertisement_requested", {
      properties: {
        provider: useAdSense ? "adsense" : "house",
        placement: "feed",
        index,
      },
    });
    void track("advertisement_displayed", {
      properties: {
        provider: useAdSense ? "adsense" : "house",
        placement: "feed",
        index,
      },
    });
  }, [index, useAdSense]);

  useEffect(() => {
    if (!useAdSense) return;

    let cancelled = false;
    const el = () => document.getElementById(slotDomId);

    const onFilled = () => {
      if (cancelled) return;
      setFilled(true);
    };

    const push = () => {
      if (pushed.current) return;
      pushed.current = true;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        /* keep house */
      }
    };

    const pushTimer = window.setTimeout(push, 40);

    const observer = new MutationObserver(() => {
      const node = el();
      if (!node) return;
      if (node.getAttribute("data-ad-status") === "filled") onFilled();
      if (node.getAttribute("data-ad-status") === "unfilled") {
        setFilled(false);
      }
    });

    const observeTimer = window.setTimeout(() => {
      const node = el();
      if (!node) return;
      observer.observe(node, {
        attributes: true,
        attributeFilter: ["data-ad-status"],
        childList: true,
        subtree: true,
      });
      if (node.getAttribute("data-ad-status") === "filled") onFilled();
    }, 60);

    // Give AdSense a short window; never leave a blank unit on screen.
    const giveUp = window.setTimeout(() => {
      const node = el();
      if (node?.getAttribute("data-ad-status") !== "filled") {
        setFilled(false);
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(pushTimer);
      window.clearTimeout(observeTimer);
      window.clearTimeout(giveUp);
      observer.disconnect();
    };
  }, [useAdSense, slotDomId]);

  if (ads.provider === "none" || !settings.adsEnabled) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black text-sm text-white/50">
        Swipe for the next episode
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Stable full-slide chrome — prevents half-ad / half-reel breaks */}
      <HouseAd index={index} />

      {useAdSense ? (
        <div
          className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0c0c10] px-3 transition-opacity duration-200 ${
            filled ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!filled}
        >
          <div className="absolute left-4 top-4 rounded-md border border-white/20 bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
            Advertisement
          </div>
          <ins
            id={slotDomId}
            className="adsbygoogle block w-full max-w-sm overflow-hidden rounded-xl"
            style={{ display: "block", minHeight: 280, width: "100%" }}
            data-ad-client={ads.clientId!}
            data-ad-slot={ads.feedSlotId!}
            data-ad-format="auto"
            data-full-width-responsive="true"
            {...(ads.testMode ? { "data-adtest": "on" } : {})}
          />
          <Link
            href="/premium"
            className="mt-4 text-xs font-semibold text-white/50 underline-offset-2 hover:text-white hover:underline"
          >
            Remove ads with Premium
          </Link>
        </div>
      ) : null}
    </div>
  );
}
