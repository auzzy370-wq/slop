"use client";

import Script from "next/script";
import { getAdsPublicConfig, adsenseScriptSrc } from "@/lib/ads/config";

/** Loads the AdSense bootstrap once when a publisher id is configured. */
export function AdsenseScript() {
  const ads = getAdsPublicConfig();
  if (ads.provider !== "adsense" || !ads.clientId) return null;

  return (
    <Script
      id="adsense-loader"
      async
      strategy="afterInteractive"
      src={adsenseScriptSrc(ads.clientId)}
      crossOrigin="anonymous"
    />
  );
}
