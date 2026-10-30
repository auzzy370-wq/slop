import type { Comment, Drama, Like, SavedVideo, Video } from "@/lib/types";
import { DEMO_DRAMAS, DEMO_VIDEOS } from "@/lib/demo-data";

/** Derive public counters only from real interaction rows — never seed fakes. */
export function applyEngagementCounts(
  videos: Video[],
  dramas: Drama[],
  likes: Like[],
  saves: SavedVideo[],
  comments: Comment[],
): { videos: Video[]; dramas: Drama[] } {
  const likeMap = new Map<string, number>();
  const saveMap = new Map<string, number>();
  const commentMap = new Map<string, number>();

  for (const l of likes) {
    likeMap.set(l.videoId, (likeMap.get(l.videoId) ?? 0) + 1);
  }
  for (const s of saves) {
    saveMap.set(s.videoId, (saveMap.get(s.videoId) ?? 0) + 1);
  }
  for (const c of comments) {
    if (c.moderationStatus === "removed") continue;
    commentMap.set(c.videoId, (commentMap.get(c.videoId) ?? 0) + 1);
  }

  const nextVideos = videos.map((v) => ({
    ...v,
    likeCount: likeMap.get(v.id) ?? 0,
    saveCount: saveMap.get(v.id) ?? 0,
    commentCount: commentMap.get(v.id) ?? 0,
    // Keep viewCount as-is (updated by recordView / analytics sync only)
  }));

  const viewsByDrama = new Map<string, number>();
  for (const v of nextVideos) {
    if (!v.dramaId) continue;
    viewsByDrama.set(
      v.dramaId,
      (viewsByDrama.get(v.dramaId) ?? 0) + (v.viewCount ?? 0),
    );
  }

  const nextDramas = dramas.map((d) => ({
    ...d,
    likeCount: nextVideos
      .filter((v) => v.dramaId === d.id)
      .reduce((s, v) => s + v.likeCount, 0),
    viewCount: viewsByDrama.get(d.id) ?? d.viewCount ?? 0,
  }));

  return { videos: nextVideos, dramas: nextDramas };
}

/** Fresh catalog with zeroed engagement; merge any local view counts by id. */
export function catalogFromSeed(viewCounts?: Map<string, number>): {
  videos: Video[];
  dramas: Drama[];
} {
  const videos = DEMO_VIDEOS.map((v) => ({
    ...v,
    viewCount: viewCounts?.get(v.id) ?? 0,
    likeCount: 0,
    commentCount: 0,
    saveCount: 0,
  }));
  const dramas = DEMO_DRAMAS.map((d) => ({
    ...d,
    viewCount: 0,
    likeCount: 0,
  }));
  return { videos, dramas };
}
