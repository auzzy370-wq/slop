import type { AnalyticsStoreData, RewardRule } from "./types";
import { uid } from "@/lib/utils";

export function defaultRewardRules(): RewardRule[] {
  const now = new Date().toISOString();
  return [
    {
      id: uid("rule"),
      key: "badge_3",
      label: "Exclusive profile badge",
      triggerType: "qualified_free_count",
      threshold: 3,
      rewardType: "profile_badge",
      rewardValue: { badge: "connector" },
      active: true,
      sortOrder: 1,
      updatedAt: now,
    },
    {
      id: uid("rule"),
      key: "adfree_7",
      label: "7 days of ad-free viewing",
      triggerType: "qualified_free_count",
      threshold: 5,
      rewardType: "ad_free_days",
      rewardValue: { days: 7 },
      active: true,
      sortOrder: 2,
      updatedAt: now,
    },
    {
      id: uid("rule"),
      key: "adfree_30",
      label: "30 days of ad-free viewing",
      triggerType: "qualified_free_count",
      threshold: 10,
      rewardType: "ad_free_days",
      rewardValue: { days: 30 },
      active: true,
      sortOrder: 3,
      updatedAt: now,
    },
    {
      id: uid("rule"),
      key: "premium_30",
      label: "30 days Premium after referred paid month",
      triggerType: "premium_referral_count",
      threshold: 1,
      rewardType: "premium_days",
      rewardValue: { days: 30, requiresReferredPaidDays: 30 },
      active: true,
      sortOrder: 4,
      updatedAt: now,
    },
  ];
}

export function emptyAnalyticsStore(): AnalyticsStoreData {
  return {
    sessions: [],
    events: [],
    campaigns: [],
    trackingLinks: [],
    playbackSessions: [],
    adRevenue: [],
    subscriptionEvents: [],
    referralCodes: [],
    referralClicks: [],
    referralRelationships: [],
    rewardRules: defaultRewardRules(),
    rewardTransactions: [],
    settings: {
      attributionWindowDays: 30,
      minWatchMinutesForQualified: 10,
      requireEmailVerification: true,
      referralEnabled: true,
      analyticsConsentRequired: true,
      updatedAt: new Date().toISOString(),
    },
    auditLog: [],
    processedIdempotencyKeys: [],
  };
}
