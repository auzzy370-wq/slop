"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Megaphone } from "lucide-react";
import { track } from "@/lib/analytics/client";
import { useSlopStore } from "@/store/slop-store";

/**
 * Full-bleed feed interstitial.
 *
 * AdSense display units are NOT mounted inside the transform pager — they
 * inject iframes that resize the slide and leave the feed stuck half-on an
 * ad / half-on the next reel. Feed breaks use a stable house CTA instead;
 * AdSense remains configured site-wide for verification / future placements.
 */
export function AdSlot({ index }: { index: number }) {
  const settings = useSlopStore((s) => s.settings);
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    void track("advertisement_requested", {
      properties: { provider: "house", placement: "feed", index },
    });
    void track("advertisement_displayed", {
      properties: { provider: "house", placement: "feed", index },
    });
  }, [index]);

  if (!settings.adsEnabled) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black text-sm text-white/50">
        Swipe for the next episode
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
