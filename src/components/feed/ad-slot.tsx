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

  useEffect(() => {
    void track("advertisement_requested", {
      properties: { provider: "house", placement: "feed", index },
    });
    void track("advertisement_displayed", {
      properties: { provider: "house", placement: "feed", index },
    });
  }, [index]);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_#1c1630_0%,_#111116_55%)] px-6 text-center">
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
        Free viewers see sponsored placements between episodes (#{index + 1}).
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
      <p className="mt-4 text-[11px] text-white/40">
        House ad — connect AdSense in Admin → Ads for live network fill.
      </p>
    </div>
  );
}

function AdSenseSlot({ index }: { index: number }) {
  const ads = getAdsPublicConfig();
  const pushed = useRef(false);
  const [failed, setFailed] = useState(false);
  const reactId = useId();

  useEffect(() => {
    void track("advertisement_requested", {
      properties: { provider: "adsense", placement: "feed", index },
    });

    if (pushed.current) return;
    pushed.current = true;

    const timer = window.setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        void track("advertisement_displayed", {
          properties: { provider: "adsense", placement: "feed", index },
        });
      } catch {
        setFailed(true);
      }
    }, 120);

    // If the unit stays empty (blocked / unfilled), fall back to house CTA.
    const fallback = window.setTimeout(() => {
      const slot = document.getElementById(`slop-ad-${reactId}`);
      const filled = Boolean(
        slot?.getAttribute("data-ad-status") === "filled" ||
          (slot && slot.clientHeight > 40 && slot.innerHTML.trim().length > 20),
      );
      if (!filled) setFailed(true);
    }, 3500);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(fallback);
    };
  }, [index, reactId]);

  if (failed || !ads.clientId || !ads.feedSlotId) {
    return <HouseAd index={index} />;
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-[#0c0c10] px-3 py-8">
      <div className="absolute left-4 top-4 rounded-md border border-white/20 bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
        Advertisement
      </div>
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <ins
          id={`slop-ad-${reactId}`}
          className="adsbygoogle block w-full overflow-hidden rounded-xl bg-black/40"
          style={{ display: "block", minHeight: 280, width: "100%" }}
          data-ad-client={ads.clientId}
          data-ad-slot={ads.feedSlotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
          {...(ads.testMode ? { "data-adtest": "on" } : {})}
        />
        <Link
          href="/premium"
          className="text-xs font-semibold text-white/50 underline-offset-2 hover:text-white hover:underline"
        >
          Remove ads with Premium
        </Link>
      </div>
    </div>
  );
}

export function AdSlot({ index }: { index: number }) {
  const ads = getAdsPublicConfig();

  if (ads.provider === "none") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-sm text-white/50">
        Swipe for the next episode
      </div>
    );
  }

  if (ads.provider === "adsense") {
    return <AdSenseSlot index={index} />;
  }

  return <HouseAd index={index} />;
}
