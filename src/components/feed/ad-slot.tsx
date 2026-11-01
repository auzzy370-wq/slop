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

function HouseAd({
  index,
  note,
}: {
  index: number;
  note?: string;
}) {
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
        {note ??
          "Sponsored slot — network ads appear here when AdSense has fill."}
      </p>
    </div>
  );
}

function isAdFilled(slot: HTMLElement | null): boolean {
  if (!slot) return false;
  const status = slot.getAttribute("data-ad-status");
  if (status === "filled") return true;
  if (status === "unfilled") return false;

  // AdSense usually injects an iframe when it fills. Ignore our own min-height.
  const iframe = slot.querySelector("iframe");
  if (iframe) {
    const h = iframe.clientHeight || Number(iframe.getAttribute("height")) || 0;
    return h > 80;
  }
  return false;
}

function AdSenseSlot({ index }: { index: number }) {
  const ads = getAdsPublicConfig();
  const pushed = useRef(false);
  const [phase, setPhase] = useState<"loading" | "filled" | "empty">("loading");
  const reactId = useId();
  const slotDomId = `slop-ad-${reactId.replace(/:/g, "")}`;

  useEffect(() => {
    void track("advertisement_requested", {
      properties: { provider: "adsense", placement: "feed", index },
    });

    if (!ads.clientId || !ads.feedSlotId) {
      setPhase("empty");
      return;
    }

    let cancelled = false;
    const slot = () => document.getElementById(slotDomId);

    const markFilled = () => {
      if (cancelled) return;
      setPhase("filled");
      void track("advertisement_displayed", {
        properties: { provider: "adsense", placement: "feed", index },
      });
    };

    const markEmpty = () => {
      if (cancelled) return;
      setPhase((p) => (p === "filled" ? p : "empty"));
    };

    const push = () => {
      if (pushed.current) return;
      pushed.current = true;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        markEmpty();
      }
    };

    // Wait a tick so <ins> is in the DOM, then request the ad.
    const pushTimer = window.setTimeout(push, 50);

    // Watch AdSense mutate data-ad-status / inject iframe.
    const observer = new MutationObserver(() => {
      const el = slot();
      if (!el) return;
      const status = el.getAttribute("data-ad-status");
      if (status === "filled" || isAdFilled(el)) markFilled();
      if (status === "unfilled") markEmpty();
    });

    const observeTimer = window.setTimeout(() => {
      const el = slot();
      if (el) {
        observer.observe(el, {
          attributes: true,
          attributeFilter: ["data-ad-status", "style", "class"],
          childList: true,
          subtree: true,
        });
        if (isAdFilled(el)) markFilled();
      }
    }, 80);

    // New sites often get zero fill — don't leave a blank black slide.
    const fallbackTimer = window.setTimeout(() => {
      const el = slot();
      if (isAdFilled(el)) markFilled();
      else markEmpty();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearTimeout(pushTimer);
      window.clearTimeout(observeTimer);
      window.clearTimeout(fallbackTimer);
      observer.disconnect();
    };
  }, [ads.clientId, ads.feedSlotId, index, slotDomId]);

  if (phase === "empty") {
    return (
      <HouseAd
        index={index}
        note="AdSense has no fill yet — house ad shown so the feed never goes blank."
      />
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_#1c1630_0%,_#111116_55%)] px-3 py-8">
      <div className="absolute left-4 top-4 rounded-md border border-white/20 bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
        Advertisement
      </div>

      {/* Keep house CTA visible under the unit until AdSense fills */}
      {phase === "loading" ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center opacity-70">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--slop-violet)]/15 text-[var(--slop-violet)]">
            <Megaphone className="h-6 w-6" />
          </div>
          <p className="font-display text-xl text-white">Loading ad…</p>
        </div>
      ) : null}

      <div
        className={`relative z-10 flex w-full max-w-sm flex-col items-center gap-4 ${
          phase === "loading" ? "min-h-[1px] opacity-0" : ""
        }`}
      >
        <ins
          id={slotDomId}
          className="adsbygoogle block w-full overflow-hidden rounded-xl"
          style={{ display: "block", minHeight: 280, width: "100%" }}
          data-ad-client={ads.clientId!}
          data-ad-slot={ads.feedSlotId!}
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

  if (ads.provider === "adsense" && ads.clientId && ads.feedSlotId) {
    return <AdSenseSlot index={index} />;
  }

  return <HouseAd index={index} />;
}
