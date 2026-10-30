"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  captureInboundAttribution,
  getConsent,
  setConsent,
  track,
} from "@/lib/analytics/client";
import { ViewCountSync } from "@/components/analytics/view-count-sync";
import { useSlopStore } from "@/store/slop-store";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useSlopStore((s) => s.currentUser);
  const booted = useRef(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    captureInboundAttribution();
    if (
      typeof window !== "undefined" &&
      localStorage.getItem("slop_analytics_consent") === null
    ) {
      setShowBanner(true);
    }
    const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    if (gaId && getConsent()) {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(s);
      const w = window as Window & {
        dataLayer?: unknown[];
        gtag?: (...a: unknown[]) => void;
      };
      w.dataLayer = w.dataLayer || [];
      w.gtag = function gtag(...args: unknown[]) {
        w.dataLayer?.push(args);
      };
      w.gtag("js", new Date());
      w.gtag("config", gaId, { send_page_view: false });
    }
  }, []);

  useEffect(() => {
    const isHome = pathname === "/";
    void track(isHome ? "homepage_viewed" : "page_viewed", {
      userId: user?.id,
      path: pathname + (searchParams?.toString() ? `?${searchParams}` : ""),
    });
  }, [pathname, searchParams, user?.id]);

  return (
    <>
      <ViewCountSync />
      {children}
      {showBanner && (
        <div className="fixed inset-x-0 bottom-20 z-[60] mx-auto w-[min(560px,calc(100%-1.5rem))] rounded-2xl border border-white/10 bg-[var(--slop-panel)] p-4 shadow-2xl sm:bottom-6">
          <p className="text-sm text-white/80">
            SLOP uses privacy-respecting analytics to improve dramas and measure
            growth. You can opt out anytime.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="h-10 flex-1 rounded-xl bg-[var(--slop-violet)] text-sm font-semibold text-[var(--slop-black)]"
              onClick={() => {
                setConsent(true);
                setShowBanner(false);
              }}
            >
              Accept
            </button>
            <button
              type="button"
              className="h-10 flex-1 rounded-xl border border-white/15 text-sm font-semibold"
              onClick={() => {
                setConsent(false);
                setShowBanner(false);
              }}
            >
              Opt out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
