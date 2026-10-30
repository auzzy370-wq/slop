"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_SETTINGS,
  DEMO_ADMIN_PROFILE,
  DEMO_COMMENTS,
  DEMO_USER_PROFILE,
  DEMO_CATEGORIES,
} from "@/lib/demo-data";
import {
  applyEngagementCounts,
  catalogFromSeed,
} from "@/lib/engagement";
import type {
  Comment,
  Drama,
  Like,
  PlatformSettings,
  Profile,
  Report,
  SavedVideo,
  SubscriptionRecord,
  Video,
  Category,
} from "@/lib/types";
import { uid } from "@/lib/utils";

const FRESH_CATALOG = catalogFromSeed();

interface SlopState {
  hydrated: boolean;
  setHydrated: (v: boolean) => void;

  currentUser: Profile | null;
  signInDemo: (asAdmin?: boolean) => void;
  signInLocal: (email: string, displayName: string) => void;
  signOut: () => void;
  updateProfile: (patch: Partial<Profile>) => void;
  requestDeletion: () => void;

  videos: Video[];
  dramas: Drama[];
  categories: Category[];
  comments: Comment[];
  likes: Like[];
  saves: SavedVideo[];
  reports: Report[];
  settings: PlatformSettings;
  subscription: SubscriptionRecord | null;

  toggleLike: (videoId: string) => { ok: boolean; needsAuth?: boolean };
  toggleSave: (videoId: string) => { ok: boolean; needsAuth?: boolean };
  addComment: (
    videoId: string,
    text: string,
  ) => { ok: boolean; needsAuth?: boolean; error?: string };
  deleteComment: (commentId: string) => void;
  addReport: (input: {
    contentType: "video" | "comment";
    contentId: string;
    reason: string;
    details: string;
  }) => { ok: boolean; needsAuth?: boolean };

  recordView: (videoId: string) => void;

  // Admin
  upsertVideo: (video: Video) => void;
  deleteVideo: (videoId: string) => void;
  upsertDrama: (drama: Drama) => void;
  upsertCategory: (category: Category) => void;
  updateSettings: (patch: Partial<PlatformSettings>) => void;
  resolveReport: (
    reportId: string,
    status: Report["status"],
    resolution: string,
  ) => void;
  setUserStatus: (
    userId: string,
    status: Profile["status"],
  ) => void;
  activatePremiumDemo: () => void;
  cancelPremiumDemo: () => void;
}

export const useSlopStore = create<SlopState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),

      currentUser: null,
      signInDemo: (asAdmin = false) => {
        const profile = asAdmin
          ? { ...DEMO_ADMIN_PROFILE }
          : { ...DEMO_USER_PROFILE };
        set({
          currentUser: profile,
          subscription: asAdmin
            ? {
                userId: profile.id,
                stripeCustomerId: "cus_demo_admin",
                stripeSubscriptionId: "sub_demo_admin",
                status: "active",
                priceId: "price_premium_monthly",
                currentPeriodEnd: new Date(
                  Date.now() + 30 * 24 * 60 * 60 * 1000,
                ).toISOString(),
                cancelAtPeriodEnd: false,
                updatedAt: new Date().toISOString(),
              }
            : null,
        });
      },
      signInLocal: (email, displayName) => {
        const profile: Profile = {
          id: uid("user"),
          email,
          displayName: displayName || email.split("@")[0],
          avatarUrl: null,
          role: "user",
          status: "active",
          isPremium: false,
          premiumBadge: false,
          createdAt: new Date().toISOString(),
          preferences: { autoplay: true, defaultMuted: true },
        };
        set({ currentUser: profile, subscription: null });
      },
      signOut: () => set({ currentUser: null }),
      updateProfile: (patch) => {
        const user = get().currentUser;
        if (!user) return;
        set({ currentUser: { ...user, ...patch } });
      },
      requestDeletion: () => {
        const user = get().currentUser;
        if (!user) return;
        set({
          currentUser: { ...user, status: "pending_deletion" },
        });
      },

      videos: FRESH_CATALOG.videos,
      dramas: FRESH_CATALOG.dramas,
      categories: DEMO_CATEGORIES,
      comments: DEMO_COMMENTS,
      likes: [],
      saves: [],
      reports: [],
      settings: DEFAULT_SETTINGS,
      subscription: null,

      toggleLike: (videoId) => {
        const user = get().currentUser;
        if (!user) return { ok: false, needsAuth: true };
        const existing = get().likes.find(
          (l) => l.userId === user.id && l.videoId === videoId,
        );
        if (existing) {
          set({
            likes: get().likes.filter((l) => l !== existing),
            videos: get().videos.map((v) =>
              v.id === videoId
                ? { ...v, likeCount: Math.max(0, v.likeCount - 1) }
                : v,
            ),
          });
        } else {
          set({
            likes: [
              ...get().likes,
              {
                userId: user.id,
                videoId,
                createdAt: new Date().toISOString(),
              },
            ],
            videos: get().videos.map((v) =>
              v.id === videoId ? { ...v, likeCount: v.likeCount + 1 } : v,
            ),
          });
        }
        return { ok: true };
      },

      toggleSave: (videoId) => {
        const user = get().currentUser;
        if (!user) return { ok: false, needsAuth: true };
        const existing = get().saves.find(
          (s) => s.userId === user.id && s.videoId === videoId,
        );
        if (existing) {
          set({
            saves: get().saves.filter((s) => s !== existing),
            videos: get().videos.map((v) =>
              v.id === videoId
                ? { ...v, saveCount: Math.max(0, v.saveCount - 1) }
                : v,
            ),
          });
        } else {
          set({
            saves: [
              {
                userId: user.id,
                videoId,
                createdAt: new Date().toISOString(),
              },
              ...get().saves,
            ],
            videos: get().videos.map((v) =>
              v.id === videoId ? { ...v, saveCount: v.saveCount + 1 } : v,
            ),
          });
        }
        return { ok: true };
      },

      addComment: (videoId, text) => {
        const user = get().currentUser;
        if (!user) return { ok: false, needsAuth: true };
        if (!get().settings.commentsEnabled) {
          return { ok: false, error: "Comments are disabled." };
        }
        const trimmed = text.trim();
        if (trimmed.length < 1 || trimmed.length > 500) {
          return { ok: false, error: "Comment must be 1–500 characters." };
        }
        const recent = get().comments.filter(
          (c) =>
            c.userId === user.id &&
            Date.now() - new Date(c.createdAt).getTime() < 15_000,
        );
        if (recent.length >= 3) {
          return { ok: false, error: "Slow down — rate limit hit." };
        }
        const comment: Comment = {
          id: uid("cmt"),
          videoId,
          userId: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          text: trimmed,
          createdAt: new Date().toISOString(),
          moderationStatus: "visible",
        };
        set({
          comments: [comment, ...get().comments],
          videos: get().videos.map((v) =>
            v.id === videoId
              ? { ...v, commentCount: v.commentCount + 1 }
              : v,
          ),
        });
        return { ok: true };
      },

      deleteComment: (commentId) => {
        const user = get().currentUser;
        const comment = get().comments.find((c) => c.id === commentId);
        if (!comment || !user) return;
        if (comment.userId !== user.id && user.role !== "admin") return;
        set({
          comments: get().comments.filter((c) => c.id !== commentId),
          videos: get().videos.map((v) =>
            v.id === comment.videoId
              ? { ...v, commentCount: Math.max(0, v.commentCount - 1) }
              : v,
          ),
        });
      },

      addReport: ({ contentType, contentId, reason, details }) => {
        const user = get().currentUser;
        if (!user) return { ok: false, needsAuth: true };
        set({
          reports: [
            {
              id: uid("rpt"),
              reporterId: user.id,
              contentType,
              contentId,
              reason,
              details,
              status: "open",
              resolution: null,
              createdAt: new Date().toISOString(),
              reviewedAt: null,
            },
            ...get().reports,
          ],
        });
        return { ok: true };
      },

      recordView: (videoId) => {
        const video = get().videos.find((v) => v.id === videoId);
        set({
          videos: get().videos.map((v) =>
            v.id === videoId ? { ...v, viewCount: v.viewCount + 1 } : v,
          ),
          dramas: video?.dramaId
            ? get().dramas.map((d) =>
                d.id === video.dramaId
                  ? { ...d, viewCount: d.viewCount + 1 }
                  : d,
              )
            : get().dramas,
        });
      },

      upsertVideo: (video) => {
        const exists = get().videos.some((v) => v.id === video.id);
        set({
          videos: exists
            ? get().videos.map((v) => (v.id === video.id ? video : v))
            : [video, ...get().videos],
        });
      },
      deleteVideo: (videoId) => {
        set({
          videos: get().videos.filter((v) => v.id !== videoId),
          comments: get().comments.filter((c) => c.videoId !== videoId),
          likes: get().likes.filter((l) => l.videoId !== videoId),
          saves: get().saves.filter((s) => s.videoId !== videoId),
        });
      },
      upsertDrama: (drama) => {
        const exists = get().dramas.some((d) => d.id === drama.id);
        set({
          dramas: exists
            ? get().dramas.map((d) => (d.id === drama.id ? drama : d))
            : [drama, ...get().dramas],
        });
      },
      upsertCategory: (category) => {
        const exists = get().categories.some((c) => c.id === category.id);
        set({
          categories: exists
            ? get().categories.map((c) =>
                c.id === category.id ? category : c,
              )
            : [...get().categories, category],
        });
      },
      updateSettings: (patch) =>
        set({ settings: { ...get().settings, ...patch } }),
      resolveReport: (reportId, status, resolution) => {
        set({
          reports: get().reports.map((r) =>
            r.id === reportId
              ? {
                  ...r,
                  status,
                  resolution,
                  reviewedAt: new Date().toISOString(),
                }
              : r,
          ),
        });
      },
      setUserStatus: () => {
        // Demo mode: only current user status is editable locally
      },
      activatePremiumDemo: () => {
        const user = get().currentUser;
        if (!user) return;
        set({
          currentUser: {
            ...user,
            isPremium: true,
            premiumBadge: true,
          },
          subscription: {
            userId: user.id,
            stripeCustomerId: "cus_demo",
            stripeSubscriptionId: "sub_demo",
            status: "active",
            priceId: "price_premium_monthly",
            currentPeriodEnd: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            cancelAtPeriodEnd: false,
            updatedAt: new Date().toISOString(),
          },
        });
      },
      cancelPremiumDemo: () => {
        const user = get().currentUser;
        if (!user) return;
        set({
          currentUser: {
            ...user,
            isPremium: false,
            premiumBadge: false,
          },
          subscription: get().subscription
            ? {
                ...get().subscription!,
                status: "canceled",
                cancelAtPeriodEnd: true,
                updatedAt: new Date().toISOString(),
              }
            : null,
        });
      },
    }),
    {
      name: "slop-local-v7",
      version: 7,
      partialize: (state) => ({
        currentUser: state.currentUser,
        // Persist only real interactions + view tallies by id — never seed fakes.
        viewCounts: Object.fromEntries(
          state.videos.map((v) => [v.id, v.viewCount] as const),
        ),
        comments: state.comments,
        likes: state.likes,
        saves: state.saves,
        reports: state.reports,
        settings: state.settings,
        subscription: state.subscription,
        categories: state.categories,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<{
          currentUser: Profile | null;
          viewCounts: Record<string, number>;
          comments: Comment[];
          likes: Like[];
          saves: SavedVideo[];
          reports: Report[];
          settings: PlatformSettings;
          subscription: SubscriptionRecord | null;
          categories: Category[];
          // legacy poisoned fields — ignored
          videos: Video[];
          dramas: Drama[];
        }>;

        const viewMap = new Map<string, number>();
        if (p.viewCounts) {
          for (const [id, n] of Object.entries(p.viewCounts)) {
            if (typeof n === "number" && n >= 0 && n < 1_000_000) {
              // Cap absurd persisted fakes from older builds
              viewMap.set(id, n > 10_000 ? 0 : n);
            }
          }
        } else if (p.videos) {
          for (const v of p.videos) {
            const n = v.viewCount ?? 0;
            viewMap.set(v.id, n > 10_000 ? 0 : Math.max(0, n));
          }
        }

        const likes = Array.isArray(p.likes) ? p.likes : [];
        const saves = Array.isArray(p.saves) ? p.saves : [];
        // Drop seed demo comments; keep only user-authored (or empty)
        const comments = Array.isArray(p.comments)
          ? p.comments.filter((c) => !String(c.id).startsWith("cmt_"))
          : [];
        const catalog = catalogFromSeed(viewMap);
        const derived = applyEngagementCounts(
          catalog.videos,
          catalog.dramas,
          likes,
          saves,
          comments,
        );

        return {
          ...current,
          ...derived,
          currentUser: p.currentUser ?? null,
          comments,
          likes,
          saves,
          reports: Array.isArray(p.reports) ? p.reports : [],
          settings: p.settings ?? DEFAULT_SETTINGS,
          subscription: p.subscription ?? null,
          categories: p.categories ?? DEMO_CATEGORIES,
        };
      },
      migrate: () => ({
        currentUser: null,
        viewCounts: {},
        comments: [],
        likes: [],
        saves: [],
        reports: [],
        settings: DEFAULT_SETTINGS,
        subscription: null,
        categories: DEMO_CATEGORIES,
      }),
      onRehydrateStorage: () => (state) => {
        if (typeof window !== "undefined") {
          for (const key of Object.keys(localStorage)) {
            if (
              key.startsWith("slop-local-v") &&
              key !== "slop-local-v7"
            ) {
              localStorage.removeItem(key);
            }
          }
        }
        state?.setHydrated(true);
      },
    },
  ),
);
