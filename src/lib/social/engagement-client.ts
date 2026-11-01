"use client";

import type { Comment, Like, Profile } from "@/lib/types";
import { resolveSocialActor } from "@/lib/social/guest";

export type EngagementPayload = {
  likes: Like[];
  comments: Comment[];
  updatedAt?: string;
};

export async function fetchSharedEngagement(): Promise<EngagementPayload | null> {
  try {
    const res = await fetch("/api/social/engagement", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as EngagementPayload;
  } catch {
    return null;
  }
}

export async function syncToggleLike(input: {
  videoId: string;
  user?: Profile | null;
}): Promise<{
  ok: boolean;
  liked?: boolean;
  likeCount?: number;
  likes?: Like[];
  error?: string;
}> {
  const actor = resolveSocialActor(input.user);
  try {
    const res = await fetch("/api/social/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: input.videoId, actorId: actor.id }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      liked?: boolean;
      likeCount?: number;
      likes?: Like[];
      error?: string;
    };
    if (!res.ok) return { ok: false, error: data.error ?? "Like failed" };
    return {
      ok: true,
      liked: data.liked,
      likeCount: data.likeCount,
      likes: data.likes,
    };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function syncAddComment(input: {
  videoId: string;
  text: string;
  user?: Profile | null;
  parentId?: string | null;
  replyToName?: string | null;
}): Promise<{
  ok: boolean;
  comment?: Comment;
  comments?: Comment[];
  commentCount?: number;
  error?: string;
}> {
  const actor = resolveSocialActor(input.user);
  try {
    const res = await fetch("/api/social/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: input.videoId,
        actorId: actor.id,
        displayName: actor.displayName,
        avatarUrl: actor.avatarUrl,
        text: input.text,
        parentId: input.parentId ?? null,
        replyToName: input.replyToName ?? null,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      comment?: Comment;
      comments?: Comment[];
      commentCount?: number;
      error?: string;
    };
    if (!res.ok) return { ok: false, error: data.error ?? "Comment failed" };
    return {
      ok: true,
      comment: data.comment,
      comments: data.comments,
      commentCount: data.commentCount,
    };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
