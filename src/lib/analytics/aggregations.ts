import { inRange } from "./dates";
import type { AnalyticsStoreData, TrafficSource } from "./types";

export function trafficSummary(
  store: AnalyticsStoreData,
  from: Date,
  to: Date,
) {
  const sessions = store.sessions.filter((s) =>
    inRange(s.startedAt, from, to),
  );
  const events = store.events.filter((e) => inRange(e.occurredAt, from, to));
  const anonymousIds = new Set(sessions.map((s) => s.anonymousId));
  const returning = [...anonymousIds].filter((id) => {
    const prior = store.sessions.some(
      (s) =>
        s.anonymousId === id &&
        new Date(s.startedAt).getTime() < from.getTime(),
    );
    return prior;
  });
  const newVisitors = anonymousIds.size - returning.length;
  const registered = new Set(
    sessions.filter((s) => s.userId).map((s) => s.userId!),
  ).size;
  const guestSessions = sessions.filter((s) => !s.userId).length;
  const activeCutoff = Date.now() - 5 * 60 * 1000;
  const currentlyActive = store.sessions.filter(
    (s) => new Date(s.lastSeenAt).getTime() >= activeCutoff,
  ).length;

  const durations = sessions.map((s) => {
    const ms =
      new Date(s.lastSeenAt).getTime() - new Date(s.startedAt).getTime();
    return Math.max(0, ms);
  });
  const avgSessionDurationMs =
    durations.length === 0
      ? 0
      : durations.reduce((a, b) => a + b, 0) / durations.length;
  const pagesPerSession =
    sessions.length === 0
      ? 0
      : sessions.reduce((a, s) => a + s.pageCount, 0) / sessions.length;
  const engaged = sessions.filter((s) => s.engaged || s.pageCount > 1).length;
  const engagementRate =
    sessions.length === 0 ? 0 : engaged / sessions.length;
  const bounced = sessions.filter((s) => s.pageCount <= 1 && !s.engaged).length;
  const bounceRate = sessions.length === 0 ? 0 : bounced / sessions.length;

  const logins = events.filter((e) => e.eventName === "login").length;
  const registrations = events.filter(
    (e) => e.eventName === "registration_completed",
  ).length;

  return {
    totalSessions: sessions.length,
    uniqueVisitors: anonymousIds.size,
    newVisitors,
    returningVisitors: returning.length,
    registeredUsers: registered,
    guestSessions,
    currentlyActive,
    averageSessionDurationMs: Math.round(avgSessionDurationMs),
    pagesPerSession: Number(pagesPerSession.toFixed(2)),
    engagementRate: Number(engagementRate.toFixed(4)),
    bounceRate: Number(bounceRate.toFixed(4)),
    registrations,
    logins,
    totalEvents: events.length,
  };
}

export function acquisitionBreakdown(
  store: AnalyticsStoreData,
  from: Date,
  to: Date,
) {
  const sessions = store.sessions.filter((s) =>
    inRange(s.startedAt, from, to),
  );
  const bySource = new Map<
    TrafficSource,
    {
      source: TrafficSource;
      sessions: number;
      visitors: Set<string>;
      registrations: number;
      payments: number;
      revenueCents: number;
    }
  >();

  for (const s of sessions) {
    const key = s.firstTouch.source;
    if (!bySource.has(key)) {
      bySource.set(key, {
        source: key,
        sessions: 0,
        visitors: new Set(),
        registrations: 0,
        payments: 0,
        revenueCents: 0,
      });
    }
    const row = bySource.get(key)!;
    row.sessions += 1;
    row.visitors.add(s.anonymousId);
  }

  const regs = store.events.filter(
    (e) =>
      e.eventName === "registration_completed" &&
      inRange(e.occurredAt, from, to),
  );
  for (const e of regs) {
    const session = store.sessions.find((s) => s.id === e.sessionId);
    const source = session?.firstTouch.source ?? e.source ?? "unknown";
    if (!bySource.has(source)) {
      bySource.set(source, {
        source,
        sessions: 0,
        visitors: new Set(),
        registrations: 0,
        payments: 0,
        revenueCents: 0,
      });
    }
    bySource.get(source)!.registrations += 1;
  }

  const payments = store.subscriptionEvents.filter(
    (e) =>
      (e.eventType === "payment_completed" ||
        e.eventType === "subscription_started") &&
      inRange(e.occurredAt, from, to),
  );
  for (const p of payments) {
    const session = store.sessions.find((s) => s.userId === p.userId);
    const source = session?.firstTouch.source ?? "unknown";
    if (!bySource.has(source)) {
      bySource.set(source, {
        source,
        sessions: 0,
        visitors: new Set(),
        registrations: 0,
        payments: 0,
        revenueCents: 0,
      });
    }
    const row = bySource.get(source)!;
    row.payments += 1;
    row.revenueCents += p.amountCents ?? 0;
  }

  return [...bySource.values()]
    .map((r) => ({
      source: r.source,
      sessions: r.sessions,
      uniqueVisitors: r.visitors.size,
      registrations: r.registrations,
      registrationRate:
        r.visitors.size === 0 ? 0 : r.registrations / r.visitors.size,
      payingCustomers: r.payments,
      revenueCents: r.revenueCents,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export function contentPerformance(
  store: AnalyticsStoreData,
  from: Date,
  to: Date,
) {
  const playbacks = store.playbackSessions.filter((p) =>
    inRange(p.startedAt, from, to),
  );
  const byEpisode = new Map<
    string,
    {
      episodeId: string;
      dramaId: string | null;
      plays: number;
      uniqueViewers: Set<string>;
      watchMs: number;
      c25: number;
      c50: number;
      c75: number;
      c100: number;
      abandoned: number;
    }
  >();

  for (const p of playbacks) {
    if (!byEpisode.has(p.episodeId)) {
      byEpisode.set(p.episodeId, {
        episodeId: p.episodeId,
        dramaId: p.dramaId,
        plays: 0,
        uniqueViewers: new Set(),
        watchMs: 0,
        c25: 0,
        c50: 0,
        c75: 0,
        c100: 0,
        abandoned: 0,
      });
    }
    const row = byEpisode.get(p.episodeId)!;
    row.plays += 1;
    row.uniqueViewers.add(p.userId || p.anonymousId || p.id);
    row.watchMs += p.watchedMs;
    if (p.completed25) row.c25 += 1;
    if (p.completed50) row.c50 += 1;
    if (p.completed75) row.c75 += 1;
    if (p.completed100) row.c100 += 1;
    if (p.abandoned) row.abandoned += 1;
  }

  const shares = store.events.filter(
    (e) => e.eventName === "share_clicked" && inRange(e.occurredAt, from, to),
  );
  const watchlists = store.events.filter(
    (e) =>
      (e.eventName === "watchlist_addition" ||
        e.eventName === "favorite_addition") &&
      inRange(e.occurredAt, from, to),
  );

  return [...byEpisode.values()]
    .map((r) => ({
      episodeId: r.episodeId,
      dramaId: r.dramaId,
      plays: r.plays,
      uniqueViewers: r.uniqueViewers.size,
      averageWatchMs: r.plays === 0 ? 0 : Math.round(r.watchMs / r.plays),
      totalWatchMs: r.watchMs,
      completion25Rate: r.plays === 0 ? 0 : r.c25 / r.plays,
      completion50Rate: r.plays === 0 ? 0 : r.c50 / r.plays,
      completion75Rate: r.plays === 0 ? 0 : r.c75 / r.plays,
      completion100Rate: r.plays === 0 ? 0 : r.c100 / r.plays,
      abandonmentRate: r.plays === 0 ? 0 : r.abandoned / r.plays,
      shares: shares.filter((e) => e.episodeId === r.episodeId).length,
      watchlistAdds: watchlists.filter((e) => e.episodeId === r.episodeId)
        .length,
    }))
    .sort((a, b) => b.plays - a.plays);
}

export function retentionBuckets(
  store: AnalyticsStoreData,
  episodeId: string,
  from: Date,
  to: Date,
) {
  const playbacks = store.playbackSessions.filter(
    (p) => p.episodeId === episodeId && inRange(p.startedAt, from, to),
  );
  const buckets = [0, 10, 25, 50, 75, 90, 100].map((pct) => ({
    pct,
    viewers: playbacks.filter((p) => p.maxPct >= pct).length,
  }));
  return { totalStarts: playbacks.length, buckets };
}

export function revenueSummary(
  store: AnalyticsStoreData,
  from: Date,
  to: Date,
) {
  const ads = store.adRevenue.filter((r) => {
    const d = new Date(r.occurredOn);
    return d >= from && d <= to;
  });
  const adImpressions = ads.reduce((a, r) => a + r.impressions, 0);
  const adRequests = ads.reduce((a, r) => a + r.requests, 0);
  const adCompletions = ads.reduce((a, r) => a + r.completions, 0);
  const adClicks = ads.reduce((a, r) => a + r.clicks, 0);
  const adRevenueCents = ads.reduce((a, r) => a + r.revenueCents, 0);
  const hasEstimates = ads.some((r) => r.isEstimate);

  const adEvents = store.events.filter(
    (e) =>
      e.eventName.startsWith("advertisement_") &&
      inRange(e.occurredAt, from, to),
  );
  const adRequested = adEvents.filter(
    (e) => e.eventName === "advertisement_requested",
  ).length;
  const adDisplayed = adEvents.filter(
    (e) => e.eventName === "advertisement_displayed",
  ).length;
  const adCompleted = adEvents.filter(
    (e) => e.eventName === "advertisement_completed",
  ).length;
  const adClicked = adEvents.filter(
    (e) => e.eventName === "advertisement_clicked",
  ).length;

  const subs = store.subscriptionEvents.filter((e) =>
    inRange(e.occurredAt, from, to),
  );
  const subscriptionRevenueCents = subs
    .filter(
      (e) =>
        e.eventType === "payment_completed" ||
        e.eventType === "subscription_started" ||
        e.eventType === "subscription_renewed",
    )
    .reduce((a, e) => a + (e.amountCents ?? 0), 0);
  const refundsCents = subs
    .filter((e) => e.eventType === "refund")
    .reduce((a, e) => a + Math.abs(e.amountCents ?? 0), 0);
  const failedPayments = subs.filter(
    (e) => e.eventType === "payment_failed",
  ).length;
  const cancellations = subs.filter(
    (e) => e.eventType === "subscription_canceled",
  ).length;

  const sessions = store.sessions.filter((s) =>
    inRange(s.startedAt, from, to),
  ).length;

  const gross = adRevenueCents + subscriptionRevenueCents;
  const net = gross - refundsCents;

  return {
    advertisingRevenueCents: adRevenueCents,
    advertisingIsEstimate: hasEstimates,
    adImpressions: adImpressions || adDisplayed,
    adRequests: adRequests || adRequested,
    adCompletions: adCompletions || adCompleted,
    adClicks: adClicks || adClicked,
    fillRate:
      (adRequests || adRequested) === 0
        ? 0
        : (adImpressions || adDisplayed) / (adRequests || adRequested),
    completionRate:
      (adImpressions || adDisplayed) === 0
        ? 0
        : (adCompletions || adCompleted) / (adImpressions || adDisplayed),
    ctr:
      (adImpressions || adDisplayed) === 0
        ? 0
        : (adClicks || adClicked) / (adImpressions || adDisplayed),
    rpm:
      (adImpressions || adDisplayed) === 0
        ? 0
        : (adRevenueCents / 100 / ((adImpressions || adDisplayed) / 1000)),
    revenuePerThousandSessions:
      sessions === 0 ? 0 : (gross / 100 / (sessions / 1000)),
    subscriptionRevenueCents,
    refundsCents,
    failedPayments,
    cancellations,
    grossRevenueCents: gross,
    estimatedNetRevenueCents: net,
    note:
      ads.length === 0
        ? "No imported ad revenue records. Ad event counts reflect tracked requests/displays only; revenue shows $0 until provider data is imported."
        : hasEstimates
          ? "Some ad revenue rows are marked as estimates."
          : "Ad revenue imported from provider records.",
  };
}

export function dailySeries(
  store: AnalyticsStoreData,
  from: Date,
  to: Date,
): { date: string; sessions: number; registrations: number; plays: number }[] {
  const days: { date: string; sessions: number; registrations: number; plays: number }[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= to) {
    const dayStart = new Date(cursor);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);
    const key = dayStart.toISOString().slice(0, 10);
    days.push({
      date: key,
      sessions: store.sessions.filter((s) =>
        inRange(s.startedAt, dayStart, dayEnd),
      ).length,
      registrations: store.events.filter(
        (e) =>
          e.eventName === "registration_completed" &&
          inRange(e.occurredAt, dayStart, dayEnd),
      ).length,
      plays: store.playbackSessions.filter((p) =>
        inRange(p.startedAt, dayStart, dayEnd),
      ).length,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
