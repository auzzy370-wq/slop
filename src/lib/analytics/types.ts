export type AnalyticsEventName =
  | "page_viewed"
  | "homepage_viewed"
  | "search_performed"
  | "search_result_clicked"
  | "registration_started"
  | "registration_completed"
  | "login"
  | "logout"
  | "profile_created"
  | "profile_updated"
  | "drama_viewed"
  | "episode_selected"
  | "video_playback_started"
  | "video_paused"
  | "video_resumed"
  | "video_completed"
  | "video_abandoned"
  | "video_progress"
  | "watchlist_addition"
  | "favorite_addition"
  | "next_episode_clicked"
  | "share_clicked"
  | "referral_link_copied"
  | "referral_link_opened"
  | "referral_registration_completed"
  | "reward_earned"
  | "reward_redeemed"
  | "advertisement_requested"
  | "advertisement_displayed"
  | "advertisement_completed"
  | "advertisement_clicked"
  | "checkout_started"
  | "payment_completed"
  | "subscription_started"
  | "subscription_renewed"
  | "subscription_canceled"
  | "payment_failed"
  | "consent_updated"
  | "campaign_link_clicked";

export type TrafficSource =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "google"
  | "direct"
  | "organic_search"
  | "paid"
  | "creator_referral"
  | "affiliate_referral"
  | "external"
  | "referral"
  | "unknown";

export interface AttributionSnapshot {
  source: TrafficSource;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  referrer: string | null;
  landing: string | null;
  campaignId: string | null;
  trackingLinkId: string | null;
  referralCode: string | null;
  at: string;
}

export interface AnalyticsSession {
  id: string;
  anonymousId: string;
  userId: string | null;
  firstTouch: AttributionSnapshot;
  lastTouch: AttributionSnapshot;
  consentAnalytics: boolean;
  startedAt: string;
  lastSeenAt: string;
  pageCount: number;
  engaged: boolean;
}

export interface AnalyticsEvent {
  id: string;
  eventName: AnalyticsEventName;
  occurredAt: string;
  sessionId: string | null;
  anonymousId: string | null;
  userId: string | null;
  path: string | null;
  referrer: string | null;
  source: TrafficSource | null;
  medium: string | null;
  campaign: string | null;
  contentId: string | null;
  dramaId: string | null;
  episodeId: string | null;
  playbackSessionId: string | null;
  properties: Record<string, unknown>;
  idempotencyKey: string | null;
}

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  platform: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrackingLink {
  id: string;
  campaignId: string;
  code: string;
  label: string;
  destinationPath: string;
  active: boolean;
  clickCount: number;
  createdAt: string;
}

export interface PlaybackSession {
  id: string;
  episodeId: string;
  dramaId: string | null;
  sessionId: string | null;
  userId: string | null;
  anonymousId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
  watchedMs: number;
  maxPct: number;
  completed25: boolean;
  completed50: boolean;
  completed75: boolean;
  completed100: boolean;
  abandoned: boolean;
}

export interface AdRevenueRecord {
  id: string;
  provider: string;
  occurredOn: string;
  impressions: number;
  requests: number;
  completions: number;
  clicks: number;
  revenueCents: number;
  isEstimate: boolean;
  dramaId: string | null;
  episodeId: string | null;
  campaignId: string | null;
  importedAt: string;
}

export interface SubscriptionEvent {
  id: string;
  userId: string;
  eventType: string;
  stripeEventId: string | null;
  amountCents: number | null;
  currency: string;
  occurredAt: string;
  meta: Record<string, unknown>;
}

export interface ReferralCode {
  userId: string;
  code: string;
  createdAt: string;
  active: boolean;
}

export interface ReferralClick {
  id: string;
  code: string;
  sessionId: string | null;
  anonymousId: string | null;
  landingPath: string | null;
  createdAt: string;
}

export type ReferralStatus =
  | "registered"
  | "qualified_free"
  | "premium"
  | "rejected"
  | "suspicious";

export interface ReferralRelationship {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  code: string;
  status: ReferralStatus;
  emailVerified: boolean;
  watchMilestoneMet: boolean;
  watchMinutes: number;
  premiumQualifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  flags: string[];
}

export type RewardTrigger = "qualified_free_count" | "premium_referral_count";
export type RewardStatus =
  | "pending"
  | "earned"
  | "redeemed"
  | "revoked"
  | "rejected";

export interface RewardRule {
  id: string;
  key: string;
  label: string;
  triggerType: RewardTrigger;
  threshold: number;
  rewardType: string;
  rewardValue: Record<string, unknown>;
  active: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface RewardTransaction {
  id: string;
  userId: string;
  ruleId: string | null;
  status: RewardStatus;
  idempotencyKey: string;
  reason: string;
  meta: Record<string, unknown>;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface AnalyticsSettings {
  attributionWindowDays: number;
  minWatchMinutesForQualified: number;
  requireEmailVerification: boolean;
  referralEnabled: boolean;
  analyticsConsentRequired: boolean;
  updatedAt: string;
}

export interface AdminAuditEntry {
  id: string;
  actorId: string;
  action: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface AnalyticsStoreData {
  sessions: AnalyticsSession[];
  events: AnalyticsEvent[];
  campaigns: Campaign[];
  trackingLinks: TrackingLink[];
  playbackSessions: PlaybackSession[];
  adRevenue: AdRevenueRecord[];
  subscriptionEvents: SubscriptionEvent[];
  referralCodes: ReferralCode[];
  referralClicks: ReferralClick[];
  referralRelationships: ReferralRelationship[];
  rewardRules: RewardRule[];
  rewardTransactions: RewardTransaction[];
  settings: AnalyticsSettings;
  auditLog: AdminAuditEntry[];
  processedIdempotencyKeys: string[];
}

export type DateRangeKey =
  | "today"
  | "yesterday"
  | "last_7"
  | "last_30"
  | "last_90"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";
