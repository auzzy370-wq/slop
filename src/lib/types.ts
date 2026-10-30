export type AccountStatus = "active" | "suspended" | "banned" | "pending_deletion";
export type UserRole = "user" | "admin";
export type PublicationStatus = "draft" | "scheduled" | "published" | "unpublished";
export type SubscriptionStatus =
  | "none"
  | "active"
  | "canceled"
  | "past_due"
  | "expired"
  | "trialing";
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
export type ModerationStatus = "visible" | "hidden" | "removed";
export type FeedSection =
  | "for-you"
  | "trending"
  | "newest"
  | "most-viewed"
  | "category"
  | "saved"
  | "search"
  | "drama";

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: AccountStatus;
  isPremium: boolean;
  premiumBadge: boolean;
  createdAt: string;
  preferences: {
    autoplay: boolean;
    defaultMuted: boolean;
  };
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  imageUrl: string | null;
  displayOrder: number;
  active: boolean;
}

export interface Drama {
  id: string;
  slug: string;
  title: string;
  synopsis: string;
  posterUrl: string;
  bannerUrl: string;
  genreIds: string[];
  tags: string[];
  status: PublicationStatus;
  featured: boolean;
  trendingRank: number | null;
  episodeCount: number;
  viewCount: number;
  likeCount: number;
  sourceAttribution: string;
  createdAt: string;
  publishedAt: string | null;
}

/** An episode is the playable short-form unit in the vertical feed. */
export interface Video {
  id: string;
  slug: string;
  dramaId: string;
  episodeNumber: number;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  aspectRatio: "9:16" | "1:1" | "16:9";
  categoryIds: string[];
  tags: string[];
  status: PublicationStatus;
  featured: boolean;
  pinned: boolean;
  sourceAttribution: string;
  licensingNotes: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  createdAt: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  commentsDisabled: boolean;
}

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  text: string;
  createdAt: string;
  moderationStatus: ModerationStatus;
  /** Parent comment id when this is a reply */
  parentId?: string | null;
  /** Display name of the user being replied to */
  replyToName?: string | null;
}

export interface Like {
  userId: string;
  videoId: string;
  createdAt: string;
}

export interface SavedVideo {
  userId: string;
  videoId: string;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string | null;
  contentType: "video" | "comment";
  contentId: string;
  reason: string;
  status: ReportStatus;
  details: string;
  resolution: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface SubscriptionRecord {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  priceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
}

export interface PlatformSettings {
  siteName: string;
  tagline: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  commentsEnabled: boolean;
  adsEnabled: boolean;
  adPlacementEvery: number;
  premiumPriceLabel: string;
  premiumMonthlyPriceCents: number;
  featuredVideoIds: string[];
  featuredDramaIds: string[];
}

export interface AdminStats {
  totalUsers: number;
  dailyActiveUsers: number;
  monthlyActiveUsers: number;
  totalVideos: number;
  totalViews: number;
  watchTimeHours: number;
  activePremium: number;
  estimatedMonthlyRevenue: number;
  openReports: number;
}
