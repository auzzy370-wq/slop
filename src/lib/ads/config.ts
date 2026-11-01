export type AdsProvider = "none" | "house" | "adsense";

export type AdsPublicConfig = {
  /** Master switch from env — platform settings can still disable in-app. */
  configured: boolean;
  provider: AdsProvider;
  clientId: string | null;
  /** AdSense ad unit / slot for between-episode interstitials */
  feedSlotId: string | null;
  /** Optional test mode — AdSense data-adtest=on */
  testMode: boolean;
};

function normalizeProvider(raw: string | undefined): AdsProvider {
  const v = (raw || "").trim().toLowerCase();
  if (v === "adsense" || v === "google") return "adsense";
  if (v === "house" || v === "premium" || v === "cta") return "house";
  if (v === "none" || v === "off" || v === "disabled") return "none";
  // If a client id is present but provider blank, assume AdSense.
  if (process.env.NEXT_PUBLIC_ADS_CLIENT_ID?.trim()) return "adsense";
  return "house";
}

/** Public ads config — safe to import in client components. */
export function getAdsPublicConfig(): AdsPublicConfig {
  const provider = normalizeProvider(process.env.NEXT_PUBLIC_ADS_PROVIDER);
  const clientId =
    (
      process.env.NEXT_PUBLIC_ADS_CLIENT_ID?.trim() ||
      "ca-pub-5591745880216042"
    ).replace(/^ca-pub-/i, "") || null;
  const feedSlotId =
    process.env.NEXT_PUBLIC_ADS_SLOT_FEED?.trim() ||
    process.env.NEXT_PUBLIC_ADS_SLOT_ID?.trim() ||
    null;
  const testMode =
    process.env.NEXT_PUBLIC_ADS_TEST_MODE === "1" ||
    process.env.NEXT_PUBLIC_ADS_TEST_MODE === "true";

  const adsenseReady = Boolean(clientId && feedSlotId);
  const configured =
    provider === "adsense"
      ? adsenseReady
      : provider === "house"
        ? true
        : false;

  return {
    configured,
    provider: provider === "adsense" && !adsenseReady ? "house" : provider,
    clientId: clientId ? `ca-pub-${clientId}` : null,
    feedSlotId,
    testMode,
  };
}

export function adsenseScriptSrc(clientId: string) {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
}
