/**
 * Parse episode numbers from common short-drama filenames.
 * Supports: EP49, EP 49, ep49.mp4, Episode 49, show-ep-49.mp4, 49.mp4
 */
export function parseEpisodeNumber(filename: string): number | null {
  const base = filename.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "");

  const patterns = [
    /\bEP\s*\.?\s*0*(\d{1,4})\b/i,
    /\bEpisode\s*0*(\d{1,4})\b/i,
    /(?:^|[-_\s.])e(?:p(?:isode)?)?[-_\s.]?0*(\d{1,4})$/i,
    /^0*(\d{1,4})$/,
  ];

  for (const re of patterns) {
    const m = base.match(re);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && n < 10000) return n;
    }
  }
  return null;
}

export type RankedUploadFile = {
  file: File;
  episodeNumber: number;
  parsed: boolean;
  label: string;
};

/** Sort files by EP## ascending; unparseable files get sequential numbers after the max. */
export function rankUploadFiles(files: File[]): RankedUploadFile[] {
  const parsed: RankedUploadFile[] = [];
  const orphan: File[] = [];

  for (const file of files) {
    const n = parseEpisodeNumber(file.name);
    if (n != null) {
      parsed.push({
        file,
        episodeNumber: n,
        parsed: true,
        label: file.name,
      });
    } else {
      orphan.push(file);
    }
  }

  parsed.sort((a, b) => a.episodeNumber - b.episodeNumber);

  // Deduplicate episode numbers — keep first, bump later duplicates
  const used = new Set<number>();
  for (const item of parsed) {
    let n = item.episodeNumber;
    while (used.has(n)) n += 1;
    item.episodeNumber = n;
    used.add(n);
  }

  let next =
    parsed.reduce((max, item) => Math.max(max, item.episodeNumber), 0) + 1;
  for (const file of orphan) {
    while (used.has(next)) next += 1;
    parsed.push({
      file,
      episodeNumber: next,
      parsed: false,
      label: file.name,
    });
    used.add(next);
    next += 1;
  }

  return parsed.sort((a, b) => a.episodeNumber - b.episodeNumber);
}

export function formatEpisodeTitle(episodeNumber: number, filename: string) {
  const base = filename.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "");
  const cleaned = base
    .replace(/\bEP\s*\.?\s*0*\d+\b/i, "")
    .replace(/\bEpisode\s*0*\d+\b/i, "")
    .replace(/[-_\s.]+/g, " ")
    .trim();
  if (cleaned && !/^\d+$/.test(cleaned)) {
    return cleaned;
  }
  return `Episode ${episodeNumber}`;
}
