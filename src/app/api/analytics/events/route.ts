import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSession, ingestEvent, upsertPlaybackProgress } from "@/lib/analytics/service";
import type { AnalyticsEventName } from "@/lib/analytics/types";
import { syncReferralWatchProgress } from "@/lib/referrals/service";

const schema = z.object({
  eventName: z.string(),
  sessionId: z.string().optional().nullable(),
  anonymousId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  path: z.string().optional().nullable(),
  referrer: z.string().optional().nullable(),
  pageUrl: z.string().optional().nullable(),
  contentId: z.string().optional().nullable(),
  dramaId: z.string().optional().nullable(),
  episodeId: z.string().optional().nullable(),
  playbackSessionId: z.string().optional().nullable(),
  properties: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().optional().nullable(),
  consentAnalytics: z.boolean().optional(),
  playback: z
    .object({
      durationMs: z.number(),
      currentMs: z.number(),
      event: z.enum(["start", "progress", "pause", "resume", "complete", "abandon"]),
    })
    .optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const data = parsed.data;

  if (data.sessionId && data.anonymousId) {
    await ensureSession({
      sessionId: data.sessionId,
      anonymousId: data.anonymousId,
      userId: data.userId,
      pageUrl: data.pageUrl,
      referrer: data.referrer,
      consentAnalytics: data.consentAnalytics,
    });
  }

  const result = await ingestEvent({
    eventName: data.eventName as AnalyticsEventName,
    sessionId: data.sessionId,
    anonymousId: data.anonymousId,
    userId: data.userId,
    path: data.path,
    referrer: data.referrer,
    pageUrl: data.pageUrl,
    contentId: data.contentId,
    dramaId: data.dramaId,
    episodeId: data.episodeId,
    playbackSessionId: data.playbackSessionId,
    properties: data.properties,
    idempotencyKey: data.idempotencyKey,
    consentAnalytics: data.consentAnalytics,
  });

  if (data.playback && data.playbackSessionId && data.episodeId) {
    const pb = await upsertPlaybackProgress({
      playbackSessionId: data.playbackSessionId,
      episodeId: data.episodeId,
      dramaId: data.dramaId,
      sessionId: data.sessionId,
      userId: data.userId,
      anonymousId: data.anonymousId,
      durationMs: data.playback.durationMs,
      currentMs: data.playback.currentMs,
      event: data.playback.event,
    });

    if (data.userId && data.playback.event === "progress") {
      // Convert watched ms delta roughly: use watchedMs / 60000 floors
      const mins = Math.floor(pb.watchedMs / 60000);
      if (mins > 0) {
        await syncReferralWatchProgress({
          userId: data.userId,
          additionalWatchMinutes: 0, // absolute sync handled via properties.watchMinutesTotal
          emailVerified: Boolean(data.properties?.emailVerified),
        });
      }
    }
    if (
      data.userId &&
      typeof data.properties?.watchMinutesTotal === "number"
    ) {
      // Set absolute by reading current and adding delta
      const { readAnalyticsStore, updateAnalyticsStore } = await import(
        "@/lib/analytics/store"
      );
      const store = await readAnalyticsStore();
      const rel = store.referralRelationships.find(
        (r) => r.referredUserId === data.userId,
      );
      if (rel) {
        const target = Number(data.properties.watchMinutesTotal);
        const delta = Math.max(0, target - rel.watchMinutes);
        if (delta > 0) {
          await syncReferralWatchProgress({
            userId: data.userId!,
            additionalWatchMinutes: delta,
            emailVerified: Boolean(data.properties.emailVerified),
          });
        } else {
          await updateAnalyticsStore(() => undefined);
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate ?? false,
    eventId: result.event?.id ?? null,
  });
}
