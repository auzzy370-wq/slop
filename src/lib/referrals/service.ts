import { uid } from "@/lib/utils";
import { readAnalyticsStore, updateAnalyticsStore } from "@/lib/analytics/store";
import type {
  ReferralCode,
  ReferralRelationship,
  RewardTransaction,
} from "@/lib/analytics/types";

function sanitizeCode(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

export async function ensureReferralCode(
  userId: string,
  preferred?: string,
): Promise<ReferralCode> {
  const store = await readAnalyticsStore();
  const existing = store.referralCodes.find((c) => c.userId === userId);
  if (existing) return existing;

  let base = sanitizeCode(preferred || userId.replace(/[^a-z0-9]/gi, "").slice(-8));
  if (base.length < 3) base = uid("ref").slice(4, 12);
  let code = base;
  let n = 1;
  while (store.referralCodes.some((c) => c.code === code)) {
    code = `${base}${n++}`;
  }

  const row: ReferralCode = {
    userId,
    code,
    createdAt: new Date().toISOString(),
    active: true,
  };
  await updateAnalyticsStore((s) => {
    s.referralCodes.push(row);
  });
  return row;
}

export async function recordReferralClick(input: {
  code: string;
  sessionId?: string | null;
  anonymousId?: string | null;
  landingPath?: string | null;
}) {
  const store = await readAnalyticsStore();
  const ref = store.referralCodes.find(
    (c) => c.code.toLowerCase() === input.code.toLowerCase() && c.active,
  );
  if (!ref) return { ok: false as const, error: "invalid_code" };

  await updateAnalyticsStore((s) => {
    s.referralClicks.push({
      id: uid("rclk"),
      code: ref.code,
      sessionId: input.sessionId ?? null,
      anonymousId: input.anonymousId ?? null,
      landingPath: input.landingPath ?? null,
      createdAt: new Date().toISOString(),
    });
  });
  return { ok: true as const, referrerUserId: ref.userId, code: ref.code };
}

export async function attachReferralOnRegistration(input: {
  referredUserId: string;
  code: string | null | undefined;
  sessionId?: string | null;
  emailVerified?: boolean;
}): Promise<{ ok: boolean; relationship?: ReferralRelationship; error?: string }> {
  if (!input.code) return { ok: true };

  const store = await readAnalyticsStore();
  if (!store.settings.referralEnabled) {
    return { ok: false, error: "referrals_disabled" };
  }

  const ref = store.referralCodes.find(
    (c) => c.code.toLowerCase() === input.code!.toLowerCase() && c.active,
  );
  if (!ref) return { ok: false, error: "invalid_code" };

  // Self-referral
  if (ref.userId === input.referredUserId) {
    await updateAnalyticsStore((s) => {
      s.auditLog.push({
        id: uid("aud"),
        actorId: "system",
        action: "referral_self_blocked",
        meta: { referredUserId: input.referredUserId, code: ref.code },
        createdAt: new Date().toISOString(),
      });
    });
    return { ok: false, error: "self_referral" };
  }

  if (store.referralRelationships.some((r) => r.referredUserId === input.referredUserId)) {
    return { ok: false, error: "already_attributed" };
  }

  // Suspicious: many registrations from same session in short window
  const flags: string[] = [];
  if (input.sessionId) {
    const recent = store.referralRelationships.filter(
      (r) =>
        Date.now() - new Date(r.createdAt).getTime() < 60 * 60 * 1000 &&
        store.events.some(
          (e) =>
            e.userId === r.referredUserId &&
            e.sessionId === input.sessionId &&
            e.eventName === "registration_completed",
        ),
    );
    if (recent.length >= 3) flags.push("burst_registrations_same_session");
  }

  const relationship: ReferralRelationship = {
    id: uid("rel"),
    referrerUserId: ref.userId,
    referredUserId: input.referredUserId,
    code: ref.code,
    status: flags.length ? "suspicious" : "registered",
    emailVerified: input.emailVerified ?? false,
    watchMilestoneMet: false,
    watchMinutes: 0,
    premiumQualifiedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    flags,
  };

  await updateAnalyticsStore((s) => {
    s.referralRelationships.push(relationship);
  });

  return { ok: true, relationship };
}

export async function syncReferralWatchProgress(input: {
  userId: string;
  additionalWatchMinutes: number;
  emailVerified?: boolean;
}) {
  const store = await readAnalyticsStore();
  const rel = store.referralRelationships.find(
    (r) => r.referredUserId === input.userId,
  );
  if (!rel || rel.status === "rejected") return null;

  const minMinutes = store.settings.minWatchMinutesForQualified;
  let updated: ReferralRelationship | null = null;

  await updateAnalyticsStore((s) => {
    const row = s.referralRelationships.find((r) => r.id === rel.id)!;
    row.watchMinutes += Math.max(0, input.additionalWatchMinutes);
    if (typeof input.emailVerified === "boolean") {
      row.emailVerified = input.emailVerified;
    }
    const emailOk =
      !s.settings.requireEmailVerification || row.emailVerified;
    row.watchMilestoneMet = row.watchMinutes >= minMinutes;
    if (
      emailOk &&
      row.watchMilestoneMet &&
      (row.status === "registered" || row.status === "suspicious") &&
      row.flags.length === 0
    ) {
      row.status = "qualified_free";
    }
    row.updatedAt = new Date().toISOString();
    updated = { ...row };
  });

  if (updated && (updated as ReferralRelationship).status === "qualified_free") {
    await evaluateRewards((updated as ReferralRelationship).referrerUserId);
  }
  return updated;
}

export async function markPremiumReferral(input: {
  referredUserId: string;
  paidDays?: number;
}) {
  const store = await readAnalyticsStore();
  const rel = store.referralRelationships.find(
    (r) => r.referredUserId === input.referredUserId,
  );
  if (!rel) return null;

  await updateAnalyticsStore((s) => {
    const row = s.referralRelationships.find((r) => r.id === rel.id)!;
    row.status = "premium";
    row.premiumQualifiedAt = new Date().toISOString();
    row.updatedAt = row.premiumQualifiedAt;
  });
  await evaluateRewards(rel.referrerUserId);
  return true;
}

export async function evaluateRewards(referrerUserId: string) {
  const store = await readAnalyticsStore();
  const qualifiedFree = store.referralRelationships.filter(
    (r) =>
      r.referrerUserId === referrerUserId &&
      (r.status === "qualified_free" || r.status === "premium"),
  ).length;
  const premiumCount = store.referralRelationships.filter(
    (r) => r.referrerUserId === referrerUserId && r.status === "premium",
  ).length;

  const earned: RewardTransaction[] = [];

  for (const rule of store.rewardRules.filter((r) => r.active)) {
    const count =
      rule.triggerType === "qualified_free_count"
        ? qualifiedFree
        : premiumCount;
    if (count < rule.threshold) continue;
    const idempotencyKey = `reward:${referrerUserId}:${rule.key}:${rule.threshold}`;
    if (store.rewardTransactions.some((t) => t.idempotencyKey === idempotencyKey)) {
      continue;
    }
    const tx: RewardTransaction = {
      id: uid("rwd"),
      userId: referrerUserId,
      ruleId: rule.id,
      status: "earned",
      idempotencyKey,
      reason: `Reached ${rule.threshold} via ${rule.triggerType}`,
      meta: { ruleKey: rule.key, rewardType: rule.rewardType, ...rule.rewardValue },
      createdAt: new Date().toISOString(),
      reviewedBy: null,
      reviewedAt: null,
    };
    earned.push(tx);
  }

  if (earned.length) {
    await updateAnalyticsStore((s) => {
      s.rewardTransactions.push(...earned);
    });
  }
  return earned;
}

export async function referralStatsForUser(userId: string) {
  const store = await readAnalyticsStore();
  const code = store.referralCodes.find((c) => c.userId === userId);
  const clicks = store.referralClicks.filter(
    (c) => code && c.code === code.code,
  ).length;
  const relationships = store.referralRelationships.filter(
    (r) => r.referrerUserId === userId,
  );
  const registrations = relationships.length;
  const qualified = relationships.filter(
    (r) => r.status === "qualified_free" || r.status === "premium",
  ).length;
  const premium = relationships.filter((r) => r.status === "premium").length;
  const rewards = store.rewardTransactions.filter((t) => t.userId === userId);
  return {
    code: code?.code ?? null,
    clicks,
    registrations,
    qualified,
    premium,
    conversionRate: clicks === 0 ? 0 : registrations / clicks,
    rewards,
    relationships,
    rules: store.rewardRules.filter((r) => r.active),
    settings: store.settings,
  };
}

export function buildReferralUrl(siteUrl: string, code: string) {
  const url = new URL("/", siteUrl);
  url.searchParams.set("ref", code);
  return url.toString();
}
