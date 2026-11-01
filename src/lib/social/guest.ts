"use client";

import { getAnonymousId } from "@/lib/analytics/client";

const GUEST_NAME_KEY = "slop_guest_display_name";

export type SocialActor = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

/** Stable per-device guest id (same as analytics anon). */
export function getGuestActorId(): string {
  if (typeof window === "undefined") return "guest_ssr";
  return getAnonymousId();
}

export function getGuestDisplayName(): string {
  if (typeof window === "undefined") return "Guest";
  const saved = localStorage.getItem(GUEST_NAME_KEY)?.trim();
  if (saved) return saved.slice(0, 32);
  const id = getAnonymousId();
  const short = id.replace(/^anon_/, "").slice(-4).toUpperCase();
  return `Guest ${short}`;
}

export function setGuestDisplayName(name: string) {
  if (typeof window === "undefined") return;
  const cleaned = name.trim().slice(0, 32);
  if (cleaned) localStorage.setItem(GUEST_NAME_KEY, cleaned);
  else localStorage.removeItem(GUEST_NAME_KEY);
}

export function resolveSocialActor(user?: {
  id: string;
  displayName: string;
  avatarUrl: string | null;
} | null): SocialActor {
  if (user) {
    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  }
  return {
    id: getGuestActorId(),
    displayName: getGuestDisplayName(),
    avatarUrl: null,
  };
}
