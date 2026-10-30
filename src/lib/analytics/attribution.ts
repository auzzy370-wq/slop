import type { AttributionSnapshot, TrafficSource } from "./types";

const SEARCH_ENGINES = [
  "google.",
  "bing.",
  "yahoo.",
  "duckduckgo.",
  "baidu.",
];

const SOCIAL_HOSTS: Record<string, TrafficSource> = {
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "instagram.com": "instagram",
  "tiktok.com": "tiktok",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "google.com": "google",
  "googleads": "google",
};

function hostOf(urlOrHost: string | null | undefined): string | null {
  if (!urlOrHost) return null;
  try {
    const u = urlOrHost.includes("://")
      ? new URL(urlOrHost)
      : new URL(`https://${urlOrHost}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return urlOrHost.toLowerCase();
  }
}

export function classifySource(input: {
  utmSource?: string | null;
  utmMedium?: string | null;
  referrer?: string | null;
  referralCode?: string | null;
  trackingCode?: string | null;
}): TrafficSource {
  const medium = (input.utmMedium ?? "").toLowerCase();
  const source = (input.utmSource ?? "").toLowerCase();
  const refHost = hostOf(input.referrer);

  if (input.referralCode) return "referral";
  if (input.trackingCode && medium.includes("affiliate")) return "affiliate_referral";
  if (medium.includes("creator") || source.includes("creator")) {
    return "creator_referral";
  }
  if (medium === "cpc" || medium === "ppc" || medium === "paid" || medium.includes("paid")) {
    return "paid";
  }

  const named = source || "";
  for (const [host, label] of Object.entries(SOCIAL_HOSTS)) {
    if (named.includes(host.replace(".com", "")) || named === label) return label;
  }
  if (named === "facebook" || named === "fb") return "facebook";
  if (named === "instagram" || named === "ig") return "instagram";
  if (named === "tiktok" || named === "tt") return "tiktok";
  if (named === "youtube" || named === "yt") return "youtube";
  if (named === "google") return "google";

  if (refHost) {
    for (const [host, label] of Object.entries(SOCIAL_HOSTS)) {
      if (refHost.includes(host)) return label;
    }
    if (SEARCH_ENGINES.some((s) => refHost.includes(s))) return "organic_search";
    return "external";
  }

  if (!source && !refHost) return "direct";
  if (source) return "external";
  return "unknown";
}

export function buildAttribution(input: {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referrer?: string | null;
  landing?: string | null;
  campaignId?: string | null;
  trackingLinkId?: string | null;
  referralCode?: string | null;
  trackingCode?: string | null;
}): AttributionSnapshot {
  return {
    source: classifySource(input),
    medium: input.utmMedium ?? null,
    campaign: input.utmCampaign ?? null,
    content: input.utmContent ?? null,
    term: input.utmTerm ?? null,
    referrer: input.referrer ?? null,
    landing: input.landing ?? null,
    campaignId: input.campaignId ?? null,
    trackingLinkId: input.trackingLinkId ?? null,
    referralCode: input.referralCode ?? null,
    at: new Date().toISOString(),
  };
}

export function parseTrackingFromUrl(url: string): {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referralCode: string | null;
  trackingCode: string | null;
} {
  try {
    const u = new URL(url, "http://localhost");
    return {
      utmSource: u.searchParams.get("utm_source"),
      utmMedium: u.searchParams.get("utm_medium"),
      utmCampaign: u.searchParams.get("utm_campaign"),
      utmContent: u.searchParams.get("utm_content"),
      utmTerm: u.searchParams.get("utm_term"),
      referralCode: u.searchParams.get("ref"),
      trackingCode: u.searchParams.get("c") || u.searchParams.get("campaign"),
    };
  } catch {
    return {
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      referralCode: null,
      trackingCode: null,
    };
  }
}
