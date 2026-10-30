"use client";

export type AutoPostClientPayload = {
  dramaId: string;
  dramaTitle: string;
  dramaSlug: string;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  episodeSlug: string;
  description?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  force?: boolean;
};

export async function triggerEpisodeAutoPost(payload: AutoPostClientPayload) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  // Optional browser override for admin key when testing locked deploys
  if (typeof window !== "undefined") {
    const key = window.localStorage.getItem("slop_admin_key");
    if (key) headers["x-slop-admin-key"] = key;
  }

  const res = await fetch("/api/social/auto-post", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  return { httpStatus: res.status, ...json };
}
