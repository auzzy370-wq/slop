"use client";

import type { AnalyticsEventName } from "./types";

const SESSION_KEY = "slop_analytics_session";
const ANON_KEY = "slop_analytics_anon";
const CONSENT_KEY = "slop_analytics_consent";
const ATTR_KEY = "slop_attribution_v1";

function rid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function getConsent(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(CONSENT_KEY);
  if (v === null) return true;
  return v === "1";
}

export function setConsent(value: boolean) {
  localStorage.setItem(CONSENT_KEY, value ? "1" : "0");
  track("consent_updated", { properties: { consent: value } });
}

export function getAnonymousId() {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = rid("anon");
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

export function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = rid("sess");
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function captureInboundAttribution() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const ref = url.searchParams.get("ref");
  const c = url.searchParams.get("c");
  const hasUtm = [...url.searchParams.keys()].some((k) => k.startsWith("utm_"));
  if (!ref && !c && !hasUtm && !document.referrer) return;

  const payload = {
    capturedAt: new Date().toISOString(),
    href: window.location.href,
    referrer: document.referrer || null,
    ref,
    c,
  };
  const existing = localStorage.getItem(ATTR_KEY);
  if (!existing) {
    localStorage.setItem(ATTR_KEY, JSON.stringify({ first: payload, last: payload }));
  } else {
    try {
      const parsed = JSON.parse(existing);
      parsed.last = payload;
      localStorage.setItem(ATTR_KEY, JSON.stringify(parsed));
    } catch {
      localStorage.setItem(ATTR_KEY, JSON.stringify({ first: payload, last: payload }));
    }
  }

  if (ref) {
    void fetch("/api/referrals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "click",
        code: ref,
        sessionId: getSessionId(),
        anonymousId: getAnonymousId(),
        landingPath: window.location.pathname,
      }),
    });
  }
}

export async function track(
  eventName: AnalyticsEventName,
  opts?: {
    userId?: string | null;
    path?: string;
    contentId?: string;
    dramaId?: string;
    episodeId?: string;
    playbackSessionId?: string;
    properties?: Record<string, unknown>;
    idempotencyKey?: string;
    playback?: {
      durationMs: number;
      currentMs: number;
      event: "start" | "progress" | "pause" | "resume" | "complete" | "abandon";
    };
  },
) {
  if (typeof window === "undefined") return;
  if (!getConsent() && eventName !== "consent_updated") {
    const critical = new Set([
      "registration_completed",
      "payment_completed",
      "subscription_started",
      "subscription_canceled",
      "payment_failed",
    ]);
    if (!critical.has(eventName)) return;
  }

  try {
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        sessionId: getSessionId(),
        anonymousId: getAnonymousId(),
        userId: opts?.userId ?? null,
        path: opts?.path ?? window.location.pathname,
        referrer: document.referrer || null,
        pageUrl: window.location.href,
        contentId: opts?.contentId,
        dramaId: opts?.dramaId,
        episodeId: opts?.episodeId,
        playbackSessionId: opts?.playbackSessionId,
        properties: opts?.properties,
        idempotencyKey: opts?.idempotencyKey,
        consentAnalytics: getConsent(),
        playback: opts?.playback,
      }),
      keepalive: true,
    });
  } catch {
    // Swallow network errors — analytics must not break UX
  }

  // Optional PostHog
  try {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (key && getConsent()) {
      const posthog = (await import("posthog-js")).default;
      if (!posthog.__loaded) {
        posthog.init(key, {
          api_host:
            process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
          capture_pageview: false,
          persistence: "localStorage",
        });
      }
      posthog.capture(eventName, {
        ...opts?.properties,
        path: opts?.path ?? window.location.pathname,
        dramaId: opts?.dramaId,
        episodeId: opts?.episodeId,
      });
    }
  } catch {
    /* optional */
  }

  // Optional GA4
  try {
    const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    if (gaId && getConsent() && typeof window !== "undefined") {
      const w = window as Window & { gtag?: (...args: unknown[]) => void };
      w.gtag?.("event", eventName, {
        page_path: opts?.path ?? window.location.pathname,
        ...opts?.properties,
      });
    }
  } catch {
    /* optional */
  }
}

export function getStoredReferralCode(): string | null {
  try {
    const raw = localStorage.getItem(ATTR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.first?.ref || parsed?.last?.ref || null;
  } catch {
    return null;
  }
}
