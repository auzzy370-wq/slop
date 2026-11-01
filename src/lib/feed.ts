import { isPlayableVideoUrl } from "./media-url";
import type { FeedSection, Video } from "./types";

function scoreForYou(video: Video): number {
  const published = video.publishedAt
    ? new Date(video.publishedAt).getTime()
    : 0;
  const ageHours = Math.max(
    1,
    (Date.now() - published) / (1000 * 60 * 60),
  );
  const engagement =
    video.viewCount * 0.2 +
    video.likeCount * 8 +
    video.commentCount * 12 +
    video.saveCount * 10;
  const featuredBoost = video.featured ? 50_000 : 0;
  const pinnedBoost = video.pinned ? 100_000 : 0;
  // Keep broken Blob uploads out of the top of For You when the store is blocked.
  const unplayablePenalty = isPlayableVideoUrl(video.videoUrl) ? 0 : -1_000_000;
  return (
    pinnedBoost +
    featuredBoost +
    unplayablePenalty +
    engagement / Math.pow(ageHours, 0.35)
  );
}

export function publishedVideos(videos: Video[]): Video[] {
  return videos.filter((v) => v.status === "published");
}

export function getFeed(
  videos: Video[],
  section: FeedSection,
  opts?: {
    categoryId?: string;
    query?: string;
    savedIds?: string[];
    /** Drop known-unplayable Blob URLs from browse feeds (not drama deep-links). */
    hideUnplayableBlob?: boolean;
  },
): Video[] {
  let list = publishedVideos(videos);

  if (
    opts?.hideUnplayableBlob &&
    section !== "drama" &&
    section !== "saved"
  ) {
    const playable = list.filter((v) => isPlayableVideoUrl(v.videoUrl));
    // Only hide when some other content remains — don't empty the feed.
    if (playable.length > 0) list = playable;
  }

  if (
    (section === "category" || section === "drama") &&
    opts?.categoryId
  ) {
    // categoryId doubles as dramaId when section === "drama"
    list =
      section === "drama"
        ? list.filter((v) => v.dramaId === opts.categoryId)
        : list.filter((v) => v.categoryIds.includes(opts.categoryId!));
  }

  if (section === "saved" && opts?.savedIds) {
    const set = new Set(opts.savedIds);
    list = list.filter((v) => set.has(v.id));
    return list.sort((a, b) => {
      const ai = opts.savedIds!.indexOf(a.id);
      const bi = opts.savedIds!.indexOf(b.id);
      return ai - bi;
    });
  }

  if (section === "search" && opts?.query) {
    const q = opts.query.toLowerCase().trim();
    list = list.filter((v) => {
      const hay = [
        v.title,
        v.description,
        v.tags.join(" "),
        v.sourceAttribution,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  switch (section) {
    case "trending":
      return [...list].sort(
        (a, b) =>
          b.likeCount + b.viewCount * 0.05 - (a.likeCount + a.viewCount * 0.05),
      );
    case "newest":
      return [...list].sort(
        (a, b) =>
          new Date(b.publishedAt ?? b.createdAt).getTime() -
          new Date(a.publishedAt ?? a.createdAt).getTime(),
      );
    case "most-viewed":
      return [...list].sort((a, b) => b.viewCount - a.viewCount);
    case "search":
      return [...list].sort((a, b) => b.viewCount - a.viewCount);
    case "drama":
      return [...list].sort((a, b) => a.episodeNumber - b.episodeNumber);
    case "category":
      return [...list].sort((a, b) => scoreForYou(b) - scoreForYou(a));
    case "for-you":
    default:
      return [...list].sort((a, b) => scoreForYou(b) - scoreForYou(a));
  }
}
