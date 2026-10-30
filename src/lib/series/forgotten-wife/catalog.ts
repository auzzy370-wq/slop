import type { Drama, Video } from "@/lib/types";
import { FORGOTTEN_WIFE_SCRIPTS } from "./scripts";
import { scriptDurationSec } from "./types";

export const FORGOTTEN_WIFE_DRAMA_ID = "drm_forgotten_wife";

export const FORGOTTEN_WIFE_DRAMA: Drama = {
  id: FORGOTTEN_WIFE_DRAMA_ID,
  slug: "the-billionaires-forgotten-wife",
  title: "The Billionaire's Forgotten Wife",
  synopsis:
    "For three years Sophia Williams was secretly married to billionaire Alexander Sterling — until his engagement to another woman. He claims he never knew her. He doesn't know she owns his company. A 60-episode SLOP original: betrayal, revenge, and a season-ending twist.",
  posterUrl: "/posters/forgotten-wife.jpg",
  bannerUrl: "/banners/forgotten-wife.jpg",
  genreIds: ["gen_romance", "gen_revenge", "gen_suspense", "gen_drama"],
  tags: [
    "billionaire",
    "revenge",
    "SLOP original",
    "subtitled",
    "60 episodes",
  ],
  status: "published",
  featured: true,
  trendingRank: 1,
  episodeCount: 60,
  viewCount: 0,
  likeCount: 0,
  sourceAttribution: "SLOP Original · Scripted cinematic series",
  createdAt: "2026-10-30T18:00:00.000Z",
  publishedAt: "2026-10-30T19:00:00.000Z",
};

/**
 * Episodes with real generated MP4s under /public/videos.
 * Durations from ffprobe after render — extend as more eps are generated.
 */
const RENDERED_DURATIONS: Record<number, number> = {
  1: 96,
  2: 45,
  3: 44,
  4: 36,
  5: 39,
  6: 32,
  7: 30,
  8: 28,
  9: 25,
  10: 30,
  11: 29,
  12: 29,
  13: 24,
  14: 28,
  15: 28,
  16: 23,
  17: 25,
  18: 22,
  19: 28,
  20: 28,
  21: 24,
  22: 23,
  23: 24,
  24: 29,
  25: 35,
  26: 21,
  27: 21,
};

function epMeta(n: number) {
  const script = FORGOTTEN_WIFE_SCRIPTS[n - 1]!;
  const pad = String(n).padStart(2, "0");
  const renderedSec = RENDERED_DURATIONS[n];
  const rendered = typeof renderedSec === "number";
  return {
    id: `ep_bfw_${pad}`,
    slug: `forgotten-wife-ep-${pad}`,
    dramaId: FORGOTTEN_WIFE_DRAMA_ID,
    episodeNumber: n,
    title: script.title,
    description:
      script.hook === script.cliffhanger
        ? script.hook
        : `${script.hook} ${script.cliffhanger}`,
    videoUrl: rendered ? `/videos/forgotten-wife-ep${n}.mp4` : "",
    thumbnailUrl: rendered
      ? `/thumbnails/forgotten-wife-ep${n}.jpg`
      : "/thumbnails/forgotten-wife-ep1.jpg",
    durationSeconds: rendered ? renderedSec : scriptDurationSec(script),
    categoryIds: ["gen_romance", "gen_revenge", "gen_suspense"],
    tags: [
      "SLOP original",
      rendered ? "generated video" : "scripted",
      "subtitles",
      `episode ${n}`,
    ],
    status: "published" as const,
    featured: n <= 2,
    pinned: n === 1,
    sourceAttribution: "The Billionaire's Forgotten Wife",
    licensingNotes: rendered
      ? "SLOP Original — generated cinematic episode (AI stills + voice + subtitles)."
      : "SLOP Original — scripted subtitled drama (video render pending).",
    createdAt: "2026-10-30T18:00:00.000Z",
    publishedAt: new Date(
      Date.parse("2026-10-30T19:00:00.000Z") + (n - 1) * 60_000,
    ).toISOString(),
    playback: (rendered ? "video" : "scripted") as "video" | "scripted",
    scriptSeriesId: "forgotten-wife",
  };
}

export const FORGOTTEN_WIFE_VIDEOS: Omit<
  Video,
  | "viewCount"
  | "likeCount"
  | "commentCount"
  | "saveCount"
  | "scheduledAt"
  | "commentsDisabled"
  | "aspectRatio"
>[] = Array.from({ length: 60 }, (_, i) => epMeta(i + 1));
