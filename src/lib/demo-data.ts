import type {
  AdminStats,
  Category,
  Comment,
  Drama,
  PlatformSettings,
  Profile,
  Video,
} from "./types";
import {
  FORGOTTEN_WIFE_DRAMA,
  FORGOTTEN_WIFE_VIDEOS,
} from "./series/forgotten-wife/catalog";
import {
  ORIGINAL_DRAMAS,
  ORIGINAL_VIDEOS,
} from "./series/originals/catalog";

export const DEMO_CATEGORIES: Category[] = [
  {
    id: "gen_romance",
    slug: "romance",
    name: "Romance",
    description: "Forbidden love, second chances, and slow-burn chemistry.",
    icon: "♥",
    imageUrl: null,
    displayOrder: 1,
    active: true,
  },
  {
    id: "gen_thriller",
    slug: "thriller",
    name: "Thriller",
    description: "Twists that refuse to let you stop at one episode.",
    icon: "⚡",
    imageUrl: null,
    displayOrder: 2,
    active: true,
  },
  {
    id: "gen_revenge",
    slug: "revenge",
    name: "Revenge",
    description: "Betrayed heroes and carefully planned payback.",
    icon: "🔥",
    imageUrl: null,
    displayOrder: 3,
    active: true,
  },
  {
    id: "gen_fantasy",
    slug: "fantasy",
    name: "Fantasy",
    description: "Crowns, curses, and worlds just beside our own.",
    icon: "✧",
    imageUrl: null,
    displayOrder: 4,
    active: true,
  },
  {
    id: "gen_suspense",
    slug: "suspense",
    name: "Suspense",
    description: "Secrets, timers, and choices with no clean exit.",
    icon: "◎",
    imageUrl: null,
    displayOrder: 5,
    active: true,
  },
  {
    id: "gen_drama",
    slug: "drama",
    name: "Drama",
    description: "Emotional arcs that linger after the credits.",
    icon: "▶",
    imageUrl: null,
    displayOrder: 6,
    active: true,
  },
];

function ep(
  partial: Omit<
    Video,
    | "viewCount"
    | "likeCount"
    | "commentCount"
    | "saveCount"
    | "scheduledAt"
    | "commentsDisabled"
    | "aspectRatio"
  > &
    Partial<Pick<Video, "aspectRatio" | "scheduledAt" | "commentsDisabled">>,
): Video {
  return {
    aspectRatio: "9:16",
    scheduledAt: null,
    commentsDisabled: false,
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    saveCount: 0,
    ...partial,
  };
}

/** All SLOP Original generated dramas — see docs/CONTENT_SOURCES.md */
export const DEMO_DRAMAS: Drama[] = [
  FORGOTTEN_WIFE_DRAMA,
  ...ORIGINAL_DRAMAS,
];

export const DEMO_VIDEOS: Video[] = [
  ...FORGOTTEN_WIFE_VIDEOS.map((v) => ep(v)),
  ...ORIGINAL_VIDEOS.map((v) => ep(v)),
];

export const DEMO_COMMENTS: Comment[] = [];

export const DEMO_ADMIN_PROFILE: Profile = {
  id: "admin_slop",
  email: "admin@slop.local",
  displayName: "SLOP Admin",
  avatarUrl: null,
  role: "admin",
  status: "active",
  isPremium: true,
  premiumBadge: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  preferences: { autoplay: true, defaultMuted: false },
};

export const DEMO_USER_PROFILE: Profile = {
  id: "user_demo",
  email: "viewer@slop.local",
  displayName: "midnightreader",
  avatarUrl: null,
  role: "user",
  status: "active",
  isPremium: false,
  premiumBadge: false,
  createdAt: "2026-10-01T00:00:00.000Z",
  preferences: { autoplay: true, defaultMuted: true },
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  siteName: "SLOP",
  tagline: "Stories That Keep You Watching.",
  maintenanceMode: false,
  registrationEnabled: true,
  commentsEnabled: true,
  adsEnabled: true,
  adPlacementEvery: 4,
  premiumPriceLabel: "$7.99/mo",
  premiumMonthlyPriceCents: 799,
  featuredVideoIds: [
    "ep_bfw_01",
    "ep_blood_contract_01",
    "ep_crown_of_ash_01",
    "ep_apartment_7_01",
  ],
  featuredDramaIds: [
    "drm_forgotten_wife",
    "drm_blood_contract",
    "drm_crown_of_ash",
    "drm_apartment_7",
  ],
};

export const DEMO_STATS: AdminStats = {
  totalUsers: 0,
  dailyActiveUsers: 0,
  monthlyActiveUsers: 0,
  totalVideos: DEMO_VIDEOS.filter((v) => v.status === "published").length,
  totalViews: 0,
  watchTimeHours: 0,
  activePremium: 0,
  estimatedMonthlyRevenue: 0,
  openReports: 0,
};
