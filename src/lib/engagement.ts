import type { Comment, Drama, Like, SavedVideo, Video } from "@/lib/types";
import { DEMO_DRAMAS, DEMO_VIDEOS } from "@/lib/demo-data";

/**
 * Live chart score from real watches/socials — not hardcoded trendingRank.
 * Seed originals with a vanity rank but zero traffic lose to uploaded hits.
 */
export function scoreDramaChart(drama: Drama, videos: Video[]): number {
  const eps = videos.filter(
    (v) => v.dramaId === drama.id && v.status === "published",
  );
  const views =
    drama.viewCount ||
    eps.reduce((sum, v) => sum + (v.viewCount ?? 0), 0);
  const likes =
    drama.likeCount ||
    eps.reduce((sum, v) => sum + (v.likeCount ?? 0), 0);
  const comments = eps.reduce((sum, v) => sum + (v.commentCount ?? 0), 0);
  const saves = eps.reduce((sum, v) => sum + (v.saveCount ?? 0), 0);
  return (
    views * 1 +
    likes * 25 +
    comments * 40 +
    saves * 20 +
    // Tiny volume signal so a watched long series edges an idle short one.
    eps.length * 0.05
  );
}

export function sortDramasByChart(
  dramas: Drama[],
  videos: Video[],
): Drama[] {
  return [...dramas].sort((a, b) => {
    const scoreDiff = scoreDramaChart(b, videos) - scoreDramaChart(a, videos);
    if (scoreDiff !== 0) return scoreDiff;
    // Tie-break only when both have no real engagement.
    const rankA = a.trendingRank ?? 999;
    const rankB = b.trendingRank ?? 999;
    if (rankA !== rankB) return rankA - rankB;
    return (b.viewCount ?? 0) - (a.viewCount ?? 0);
  });
}

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
