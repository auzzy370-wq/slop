import { uid } from "@/lib/utils";
import { buildAttribution, parseTrackingFromUrl } from "./attribution";
import { readAnalyticsStore, updateAnalyticsStore } from "./store";
import type {
  AnalyticsEvent,
  AnalyticsEventName,
  AnalyticsSession,
  AttributionSnapshot,
  Campaign,
  PlaybackSession,
  TrackingLink,
} from "./types";

export interface IngestEventInput {
  eventName: AnalyticsEventName;
  sessionId?: string | null;
  anonymousId?: string | null;
  userId?: string | null;
  path?: string | null;
  referrer?: string | null;
  pageUrl?: string | null;
  contentId?: string | null;
  dramaId?: string | null;
  episodeId?: string | null;
  playbackSessionId?: string | null;
  properties?: Record<string, unknown>;
  idempotencyKey?: string | null;
  consentAnalytics?: boolean;
  occurredAt?: string;
}

function touchFromUrl(
  pageUrl: string | null | undefined,
  referrer: string | null | undefined,
  extras?: Partial<AttributionSnapshot>,
): AttributionSnapshot {
  const parsed = parseTrackingFromUrl(pageUrl ?? "");
  return buildAttribution({
    ...parsed,
    referrer,
    landing: extras?.landing ?? (pageUrl ? new URL(pageUrl, "http://x").pathname : null),
    campaignId: extras?.campaignId ?? null,
    trackingLinkId: extras?.trackingLinkId ?? null,
  });
}

export async function ensureSession(input: {
  sessionId: string;
  anonymousId: string;
  userId?: string | null;
  pageUrl?: string | null;
  referrer?: string | null;
  consentAnalytics?: boolean;
  campaignId?: string | null;
  trackingLinkId?: string | null;
  referralCode?: string | null;
}): Promise<AnalyticsSession> {
  const now = new Date().toISOString();
  let created: AnalyticsSession | null = null;

  await updateAnalyticsStore((store) => {
    let session = store.sessions.find((s) => s.id === input.sessionId);
    const touch = touchFromUrl(input.pageUrl, input.referrer, {
      campaignId: input.campaignId ?? null,
      trackingLinkId: input.trackingLinkId ?? null,
      referralCode: input.referralCode ?? null,
      landing: input.pageUrl ? new URL(input.pageUrl, "http://x").pathname : "/",
      source: "unknown",
      medium: null,
      campaign: null,
      content: null,
      term: null,
      referrer: input.referrer ?? null,
      at: now,
    });
    // rebuild properly
    const attrib = buildAttribution({
      ...parseTrackingFromUrl(input.pageUrl ?? ""),
      referrer: input.referrer,
      landing: input.pageUrl ? new URL(input.pageUrl, "http://x").pathname : "/",
      campaignId: input.campaignId,
      trackingLinkId: input.trackingLinkId,
      referralCode: input.referralCode ?? parseTrackingFromUrl(input.pageUrl ?? "").referralCode,
    });

    if (!session) {
      session = {
        id: input.sessionId,
        anonymousId: input.anonymousId,
        userId: input.userId ?? null,
        firstTouch: attrib,
        lastTouch: attrib,
        consentAnalytics: input.consentAnalytics ?? true,
        startedAt: now,
        lastSeenAt: now,
        pageCount: 0,
        engaged: false,
      };
      store.sessions.push(session);
      created = session;
    } else {
      // Preserve first-touch; update last-touch only when new attribution evidence exists
      const hasNew =
        attrib.source !== "direct" ||
        attrib.campaign ||
        attrib.referralCode ||
        attrib.trackingLinkId;
      if (hasNew && attrib.source !== "unknown") {
        session.lastTouch = attrib;
      }
      if (input.userId) session.userId = input.userId;
      if (typeof input.consentAnalytics === "boolean") {
        session.consentAnalytics = input.consentAnalytics;
      }
      session.lastSeenAt = now;
    }
    void touch;
  });

  const store = await readAnalyticsStore();
  return store.sessions.find((s) => s.id === input.sessionId)! ?? created!;
}

export async function ingestEvent(
  input: IngestEventInput,
): Promise<{ ok: true; event: AnalyticsEvent | null; duplicate?: boolean }> {
  const store = await readAnalyticsStore();
  if (input.idempotencyKey && store.processedIdempotencyKeys.includes(input.idempotencyKey)) {
    return { ok: true, event: null, duplicate: true };
  }

  const session = input.sessionId
    ? store.sessions.find((s) => s.id === input.sessionId)
    : null;

  if (session && !session.consentAnalytics && input.eventName !== "consent_updated") {
    // Respect opt-out: only allow consent updates and critical server payment events
    const critical = [
      "payment_completed",
      "subscription_started",
      "subscription_renewed",
      "subscription_canceled",
      "payment_failed",
      "registration_completed",
    ];
    if (!critical.includes(input.eventName)) {
      return { ok: true, event: null };
    }
  }

  const event: AnalyticsEvent = {
    id: uid("evt"),
    eventName: input.eventName,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    sessionId: input.sessionId ?? null,
    anonymousId: input.anonymousId ?? null,
    userId: input.userId ?? null,
    path: input.path ?? null,
    referrer: input.referrer ?? null,
    source: session?.lastTouch.source ?? null,
    medium: session?.lastTouch.medium ?? null,
    campaign: session?.lastTouch.campaign ?? null,
    contentId: input.contentId ?? null,
    dramaId: input.dramaId ?? null,
    episodeId: input.episodeId ?? null,
    playbackSessionId: input.playbackSessionId ?? null,
    properties: input.properties ?? {},
    idempotencyKey: input.idempotencyKey ?? null,
  };

  await updateAnalyticsStore((draft) => {
    draft.events.push(event);
    if (input.idempotencyKey) {
      draft.processedIdempotencyKeys.push(input.idempotencyKey);
      // Cap idempotency memory
      if (draft.processedIdempotencyKeys.length > 50_000) {
        draft.processedIdempotencyKeys = draft.processedIdempotencyKeys.slice(-25_000);
      }
    }
    if (input.sessionId) {
      const s = draft.sessions.find((x) => x.id === input.sessionId);
      if (s) {
        s.lastSeenAt = event.occurredAt;
        if (input.eventName === "page_viewed" || input.eventName === "homepage_viewed") {
          s.pageCount += 1;
        }
        if (
          [
            "video_playback_started",
            "drama_viewed",
            "search_performed",
            "share_clicked",
          ].includes(input.eventName)
        ) {
          s.engaged = true;
        }
        if (input.userId) s.userId = input.userId;
      }
    }
    // Cap event retention in local store (keep last 100k)
    if (draft.events.length > 100_000) {
      draft.events = draft.events.slice(-80_000);
    }
  });

  return { ok: true, event };
}

export async function upsertPlaybackProgress(input: {
  playbackSessionId: string;
  episodeId: string;
  dramaId?: string | null;
  sessionId?: string | null;
  userId?: string | null;
  anonymousId?: string | null;
  durationMs: number;
  currentMs: number;
  event: "start" | "progress" | "pause" | "resume" | "complete" | "abandon";
}): Promise<PlaybackSession> {
  const now = new Date().toISOString();
  let result: PlaybackSession | null = null;

  await updateAnalyticsStore((store) => {
    let pb = store.playbackSessions.find((p) => p.id === input.playbackSessionId);
    const pct =
      input.durationMs > 0
        ? Math.min(100, (input.currentMs / input.durationMs) * 100)
        : 0;

    if (!pb) {
      pb = {
        id: input.playbackSessionId,
        episodeId: input.episodeId,
        dramaId: input.dramaId ?? null,
        sessionId: input.sessionId ?? null,
        userId: input.userId ?? null,
        anonymousId: input.anonymousId ?? null,
        startedAt: now,
        endedAt: null,
        durationMs: input.durationMs,
        watchedMs: input.currentMs,
        maxPct: pct,
        completed25: pct >= 25,
        completed50: pct >= 50,
        completed75: pct >= 75,
        completed100: pct >= 95 || input.event === "complete",
        abandoned: false,
      };
      store.playbackSessions.push(pb);
    } else {
      pb.durationMs = Math.max(pb.durationMs, input.durationMs);
      pb.watchedMs = Math.max(pb.watchedMs, input.currentMs);
      pb.maxPct = Math.max(pb.maxPct, pct);
      if (pct >= 25) pb.completed25 = true;
      if (pct >= 50) pb.completed50 = true;
      if (pct >= 75) pb.completed75 = true;
      if (pct >= 95 || input.event === "complete") pb.completed100 = true;
      if (input.event === "abandon") {
        pb.abandoned = !pb.completed100;
        pb.endedAt = now;
      }
      if (input.event === "complete") {
        pb.abandoned = false;
        pb.endedAt = now;
      }
    }
    result = pb;
  });

  return result!;
}

export async function createCampaign(input: {
  name: string;
  platform: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  notes?: string;
}): Promise<Campaign> {
  const now = new Date().toISOString();
  const campaign: Campaign = {
    id: uid("cmp"),
    name: input.name,
    slug: input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, ""),
    platform: input.platform,
    utmSource: input.utmSource ?? input.platform,
    utmMedium: input.utmMedium ?? "social",
    utmCampaign: input.utmCampaign ?? input.name.toLowerCase().replace(/\s+/g, "_"),
    utmContent: input.utmContent ?? null,
    utmTerm: input.utmTerm ?? null,
    active: true,
    notes: input.notes ?? "",
    createdAt: now,
    updatedAt: now,
  };
  await updateAnalyticsStore((s) => {
    s.campaigns.push(campaign);
  });
  return campaign;
}

export async function createTrackingLink(input: {
  campaignId: string;
  label: string;
  destinationPath?: string;
}): Promise<TrackingLink> {
  const link: TrackingLink = {
    id: uid("lnk"),
    campaignId: input.campaignId,
    code: uid("c").replace("c_", "").slice(0, 10),
    label: input.label,
    destinationPath: input.destinationPath ?? "/",
    active: true,
    clickCount: 0,
    createdAt: new Date().toISOString(),
  };
  await updateAnalyticsStore((s) => {
    s.trackingLinks.push(link);
  });
  return link;
}

export async function recordTrackingClick(code: string, meta: {
  sessionId?: string;
  anonymousId?: string;
  path?: string;
}) {
  await updateAnalyticsStore((s) => {
    const link = s.trackingLinks.find((l) => l.code === code && l.active);
    if (!link) return;
    link.clickCount += 1;
    const campaign = s.campaigns.find((c) => c.id === link.campaignId);
    void campaign;
    void meta;
  });
}

export function buildCampaignUrl(opts: {
  siteUrl: string;
  destinationPath: string;
  campaign: Campaign;
  trackingCode?: string;
}): string {
  const url = new URL(opts.destinationPath, opts.siteUrl);
  if (opts.campaign.utmSource) url.searchParams.set("utm_source", opts.campaign.utmSource);
  if (opts.campaign.utmMedium) url.searchParams.set("utm_medium", opts.campaign.utmMedium);
  if (opts.campaign.utmCampaign) url.searchParams.set("utm_campaign", opts.campaign.utmCampaign);
  if (opts.campaign.utmContent) url.searchParams.set("utm_content", opts.campaign.utmContent);
  if (opts.campaign.utmTerm) url.searchParams.set("utm_term", opts.campaign.utmTerm);
  if (opts.trackingCode) url.searchParams.set("c", opts.trackingCode);
  return url.toString();
}
