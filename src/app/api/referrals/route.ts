import { NextResponse } from "next/server";
import { z } from "zod";
import {
  attachReferralOnRegistration,
  buildReferralUrl,
  ensureReferralCode,
  recordReferralClick,
  referralStatsForUser,
  evaluateRewards,
} from "@/lib/referrals/service";
import { readAnalyticsStore, updateAnalyticsStore } from "@/lib/analytics/store";
import { ingestEvent } from "@/lib/analytics/service";
import { uid } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId_required" }, { status: 400 });
  }
  const preferred = searchParams.get("preferredCode") ?? undefined;
  await ensureReferralCode(userId, preferred);
  const stats = await referralStatsForUser(userId);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3456";
  return NextResponse.json({
    ...stats,
    referralUrl: stats.code ? buildReferralUrl(siteUrl, stats.code) : null,
  });
}

const postSchema = z.object({
  action: z.enum([
    "click",
    "register",
    "redeem",
    "verify_email",
    "admin_update_rule",
    "admin_review_reward",
    "admin_update_settings",
  ]),
  code: z.string().optional(),
  sessionId: z.string().optional().nullable(),
  anonymousId: z.string().optional().nullable(),
  landingPath: z.string().optional().nullable(),
  referredUserId: z.string().optional(),
  userId: z.string().optional(),
  emailVerified: z.boolean().optional(),
  rewardId: z.string().optional(),
  status: z.string().optional(),
  actorId: z.string().optional(),
  ruleId: z.string().optional(),
  threshold: z.number().optional(),
  active: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const data = parsed.data;

  if (data.action === "click" && data.code) {
    const res = await recordReferralClick({
      code: data.code,
      sessionId: data.sessionId,
      anonymousId: data.anonymousId,
      landingPath: data.landingPath,
    });
    if (res.ok) {
      await ingestEvent({
        eventName: "referral_link_opened",
        sessionId: data.sessionId,
        anonymousId: data.anonymousId,
        path: data.landingPath,
        properties: { code: data.code },
      });
    }
    return NextResponse.json(res);
  }

  if (data.action === "register" && data.referredUserId) {
    const res = await attachReferralOnRegistration({
      referredUserId: data.referredUserId,
      code: data.code,
      sessionId: data.sessionId,
      emailVerified: data.emailVerified,
    });
    if (res.ok && res.relationship) {
      await ingestEvent({
        eventName: "referral_registration_completed",
        sessionId: data.sessionId,
        userId: data.referredUserId,
        properties: { code: data.code, relationshipId: res.relationship.id },
        idempotencyKey: `refreg:${data.referredUserId}`,
      });
    }
    return NextResponse.json(res);
  }

  if (data.action === "verify_email" && data.userId) {
    await updateAnalyticsStore((s) => {
      const rel = s.referralRelationships.find(
        (r) => r.referredUserId === data.userId,
      );
      if (rel) {
        rel.emailVerified = true;
        rel.updatedAt = new Date().toISOString();
      }
    });
    const { syncReferralWatchProgress } = await import(
      "@/lib/referrals/service"
    );
    await syncReferralWatchProgress({
      userId: data.userId,
      additionalWatchMinutes: 0,
      emailVerified: true,
    });
    return NextResponse.json({ ok: true });
  }

  if (data.action === "redeem" && data.userId && data.rewardId) {
    let ok = false;
    await updateAnalyticsStore((s) => {
      const tx = s.rewardTransactions.find(
        (t) => t.id === data.rewardId && t.userId === data.userId,
      );
      if (tx && tx.status === "earned") {
        tx.status = "redeemed";
        ok = true;
      }
    });
    if (ok) {
      await ingestEvent({
        eventName: "reward_redeemed",
        userId: data.userId,
        properties: { rewardId: data.rewardId },
        idempotencyKey: `redeem:${data.rewardId}`,
      });
    }
    return NextResponse.json({ ok });
  }

  if (
    data.action === "admin_update_rule" ||
    data.action === "admin_review_reward" ||
    data.action === "admin_update_settings"
  ) {
    const { requireAdminKey } = await import("@/lib/admin-guard");
    const denied = requireAdminKey(request);
    if (denied) return denied;
  }

  if (data.action === "admin_update_rule" && data.ruleId) {
    await updateAnalyticsStore((s) => {
      const rule = s.rewardRules.find((r) => r.id === data.ruleId);
      if (!rule) return;
      if (typeof data.threshold === "number") rule.threshold = data.threshold;
      if (typeof data.active === "boolean") rule.active = data.active;
      rule.updatedAt = new Date().toISOString();
      s.auditLog.push({
        id: uid("aud"),
        actorId: data.actorId ?? "admin",
        action: "reward_rule_updated",
        meta: { ruleId: data.ruleId, threshold: data.threshold, active: data.active },
        createdAt: new Date().toISOString(),
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (data.action === "admin_review_reward" && data.rewardId && data.status) {
    await updateAnalyticsStore((s) => {
      const tx = s.rewardTransactions.find((t) => t.id === data.rewardId);
      if (!tx) return;
      if (["earned", "redeemed", "revoked", "rejected", "pending"].includes(data.status!)) {
        tx.status = data.status as typeof tx.status;
        tx.reviewedBy = data.actorId ?? "admin";
        tx.reviewedAt = new Date().toISOString();
      }
      s.auditLog.push({
        id: uid("aud"),
        actorId: data.actorId ?? "admin",
        action: "reward_reviewed",
        meta: { rewardId: data.rewardId, status: data.status },
        createdAt: new Date().toISOString(),
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (data.action === "admin_update_settings" && data.settings) {
    await updateAnalyticsStore((s) => {
      const st = s.settings;
      if (typeof data.settings!.attributionWindowDays === "number") {
        st.attributionWindowDays = data.settings!.attributionWindowDays as number;
      }
      if (typeof data.settings!.minWatchMinutesForQualified === "number") {
        st.minWatchMinutesForQualified = data.settings!
          .minWatchMinutesForQualified as number;
      }
      if (typeof data.settings!.requireEmailVerification === "boolean") {
        st.requireEmailVerification = data.settings!
          .requireEmailVerification as boolean;
      }
      if (typeof data.settings!.referralEnabled === "boolean") {
        st.referralEnabled = data.settings!.referralEnabled as boolean;
      }
      st.updatedAt = new Date().toISOString();
      s.auditLog.push({
        id: uid("aud"),
        actorId: data.actorId ?? "admin",
        action: "analytics_settings_updated",
        meta: data.settings!,
        createdAt: new Date().toISOString(),
      });
    });
    return NextResponse.json({ ok: true });
  }

  // Force re-eval rewards
  if (data.userId) await evaluateRewards(data.userId);

  return NextResponse.json({ error: "unhandled_action" }, { status: 400 });
}

export async function PUT(request: Request) {
  const { requireAdminKey } = await import("@/lib/admin-guard");
  const denied = requireAdminKey(request);
  // Allow read of overview locally; on Vercel without key, still allow GET-like overview
  // but require key when SLOP_ADMIN_KEY is configured.
  if (process.env.SLOP_ADMIN_KEY && denied) return denied;
  const store = await readAnalyticsStore();
  const clicks = store.referralClicks.length;
  const registrations = store.referralRelationships.length;
  const qualified = store.referralRelationships.filter(
    (r) => r.status === "qualified_free" || r.status === "premium",
  ).length;
  const premium = store.referralRelationships.filter(
    (r) => r.status === "premium",
  ).length;
  const issued = store.rewardTransactions.filter((t) =>
    ["earned", "redeemed"].includes(t.status),
  ).length;
  const redeemed = store.rewardTransactions.filter(
    (t) => t.status === "redeemed",
  ).length;
  const pending = store.rewardTransactions.filter(
    (t) => t.status === "pending",
  ).length;
  const suspicious = store.referralRelationships.filter(
    (r) => r.status === "suspicious" || r.flags.length > 0,
  );

  const topReferrers = Object.values(
    store.referralRelationships.reduce<
      Record<string, { userId: string; count: number; premium: number }>
    >((acc, r) => {
      if (!acc[r.referrerUserId]) {
        acc[r.referrerUserId] = {
          userId: r.referrerUserId,
          count: 0,
          premium: 0,
        };
      }
      acc[r.referrerUserId].count += 1;
      if (r.status === "premium") acc[r.referrerUserId].premium += 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return NextResponse.json({
    totals: {
      clicks,
      registrations,
      qualified,
      premium,
      issued,
      redeemed,
      pending,
      conversionRate: clicks === 0 ? 0 : registrations / clicks,
    },
    rules: store.rewardRules,
    settings: store.settings,
    relationships: store.referralRelationships,
    rewards: store.rewardTransactions,
    suspicious,
    topReferrers,
    auditLog: store.auditLog.slice(-100).reverse(),
  });
}
