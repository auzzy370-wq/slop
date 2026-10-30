import type { Video } from "@/lib/types";
import {
  ORIGINAL_SERIES as BATCH1_SERIES,
  dramaFromOriginal,
  type OriginalSeriesDef,
} from "./definitions";
import { BATCH2_SERIES } from "./batch2";
import { scriptDurationSec } from "@/lib/series/forgotten-wife/types";

export const ORIGINAL_SERIES: OriginalSeriesDef[] = [
  ...BATCH1_SERIES,
  ...BATCH2_SERIES,
];

/** Durations filled after render — auto-extend via scripts/sync-rendered-durations.py */
export const ORIGINAL_RENDERED_DURATIONS: Record<
  string,
  Record<number, number>
> = {
  "apartment-7": {
    1: 27,
    2: 23,
    3: 26,
    4: 26,
    5: 25,
    6: 25,
  },
  "black-card-ex": {
    1: 18,
    2: 15,
    3: 15,
    4: 18,
  },
  "blood-contract": {
    1: 37,
    2: 30,
    3: 30,
    4: 26,
    5: 26,
    6: 28,
    7: 26,
    8: 34,
  },
  "boss-soft-spot": {
    1: 18,
    2: 19,
    3: 19,
    4: 17,
  },
  "crown-of-ash": {
    1: 32,
    2: 26,
    3: 24,
    4: 30,
    5: 25,
    6: 24,
    7: 23,
    8: 27,
  },
  "custody-weekend": {
    1: 16,
    2: 18,
    3: 15,
    4: 16,
  },
  "deepfake-alibi": {
    1: 14,
    2: 17,
    3: 14,
    4: 19,
  },
  "draft-saved": {
    1: 26,
    2: 24,
    3: 25,
    4: 22,
    5: 25,
    6: 26,
  },
  "dragon-dowry": {
    1: 14,
    2: 16,
    3: 16,
    4: 14,
  },
  "elevator-13": {
    1: 22,
    2: 16,
    3: 15,
    4: 17,
  },
  "empty-chair-dinner": {
    1: 17,
    2: 17,
    3: 18,
    4: 16,
  },
  "fake-dating-app": {
    1: 20,
    2: 18,
    3: 17,
    4: 21,
  },
  "glass-witch": {
    1: 15,
    2: 15,
    3: 15,
    4: 18,
  },
  "last-guest": {
    1: 15,
    2: 15,
    3: 13,
    4: 16,
  },
  "midnight-internship": {
    1: 24,
    2: 19,
    3: 20,
    4: 22,
  },
  "mirror-debt": {
    1: 15,
    2: 14,
    3: 16,
    4: 15,
  },
  "missing-hour": {
    1: 18,
    2: 17,
    3: 16,
    4: 17,
  },
  "moonpawn": {
    1: 14,
    2: 15,
    3: 15,
    4: 15,
  },
  "nanny-clause": {
    1: 16,
    2: 16,
    3: 17,
    4: 20,
  },
  "neon-vow": {
    1: 26,
    2: 25,
    3: 23,
    4: 25,
    5: 25,
    6: 23,
  },
  "password-wife": {
    1: 14,
    2: 15,
    3: 14,
    4: 18,
  },
  "raincheck-bride": {
    1: 21,
    2: 18,
    3: 17,
    4: 19,
  },
  "red-light-witness": {
    1: 16,
    2: 15,
    3: 15,
    4: 17,
  },
  "silent-auction": {
    1: 15,
    2: 15,
    3: 14,
    4: 17,
  },
  "sisters-scar": {
    1: 16,
    2: 14,
    3: 14,
    4: 18,
  },
  "stolen-pitch": {
    1: 15,
    2: 16,
    3: 17,
    4: 18,
  },
  "timer-on-the-door": {
    1: 16,
    2: 14,
    3: 15,
    4: 18,
  },
  "voicemail-from-dad": {
    1: 18,
    2: 16,
    3: 16,
    4: 17,
  },
  "wedding-crash-heiress": {
    1: 20,
    2: 16,
    3: 15,
    4: 18,
  },
};


function videosForSeries(s: OriginalSeriesDef): Omit<
  Video,
  | "viewCount"
  | "likeCount"
  | "commentCount"
  | "saveCount"
  | "scheduledAt"
  | "commentsDisabled"
  | "aspectRatio"
>[] {
  const durs = ORIGINAL_RENDERED_DURATIONS[s.id] ?? {};
  return s.scripts.map((script) => {
    const n = script.episodeNumber;
    const renderedSec = durs[n];
    const rendered = typeof renderedSec === "number";
    return {
      id: `ep_${s.id.replace(/-/g, "_")}_${String(n).padStart(2, "0")}`,
      slug: `${s.slug}-ep-${String(n).padStart(2, "0")}`,
      dramaId: s.dramaId,
      episodeNumber: n,
      title: script.title,
      description:
        script.hook === script.cliffhanger
          ? script.hook
          : `${script.hook} ${script.cliffhanger}`,
      videoUrl: rendered ? `/videos/${s.id}-ep${n}.mp4` : "",
      thumbnailUrl: rendered
        ? `/thumbnails/${s.id}-ep${n}.jpg`
        : `/posters/${s.id}.jpg`,
      durationSeconds: rendered ? renderedSec : scriptDurationSec(script),
      categoryIds: s.genreIds,
      tags: [...s.tags, "generated video", `episode ${n}`],
      status: "published" as const,
      featured: n === 1 && s.featured,
      pinned: n === 1 && s.trendingRank <= 2,
      sourceAttribution: s.title,
      licensingNotes:
        "SLOP Original — generated cinematic episode (AI stills + voice + subtitles).",
      createdAt: "2026-10-30T20:00:00.000Z",
      publishedAt: new Date(
        Date.parse("2026-10-30T20:30:00.000Z") +
          s.trendingRank * 100_000 +
          n * 60_000,
      ).toISOString(),
      playback: (rendered ? "video" : "scripted") as "video" | "scripted",
      scriptSeriesId: s.id,
    };
  });
}

export const ORIGINAL_DRAMAS = ORIGINAL_SERIES.map(dramaFromOriginal);

export const ORIGINAL_VIDEOS = ORIGINAL_SERIES.flatMap(videosForSeries);

export function getOriginalScript(seriesId: string, episodeNumber: number) {
  const series = ORIGINAL_SERIES.find((s) => s.id === seriesId);
  return series?.scripts.find((s) => s.episodeNumber === episodeNumber);
}
