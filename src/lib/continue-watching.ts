/** Local continue-watching progress — one entry per series (latest episode). */

export type ContinueWatchEntry = {
  dramaId: string;
  episodeId: string;
  episodeNumber: number;
  positionSec: number;
  durationSec: number;
  updatedAt: string;
};

const STORAGE_KEY = "slop-continue-watching-v1";
const CHANGE_EVENT = "slop:continue-watching";
/** Don't clutter the row for a 2-second peek. */
export const CONTINUE_MIN_SECONDS = 3;
/** Treat as finished — drop from continue watching. */
export const CONTINUE_COMPLETE_RATIO = 0.92;
const MAX_ENTRIES = 24;

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function emitChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function readContinueWatching(): ContinueWatchEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is ContinueWatchEntry => {
        if (!row || typeof row !== "object") return false;
        const r = row as ContinueWatchEntry;
        return (
          typeof r.dramaId === "string" &&
          typeof r.episodeId === "string" &&
          typeof r.episodeNumber === "number" &&
          typeof r.positionSec === "number" &&
          typeof r.durationSec === "number" &&
          typeof r.updatedAt === "string"
        );
      })
      .sort(
        (a, b) =>
          Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
          b.positionSec - a.positionSec,
      );
  } catch {
    return [];
  }
}

function writeAll(entries: ContinueWatchEntry[]) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_ENTRIES)),
    );
    emitChange();
  } catch {
    /* quota / private mode */
  }
}

export function getContinueForDrama(
  dramaId: string,
): ContinueWatchEntry | null {
  return readContinueWatching().find((e) => e.dramaId === dramaId) ?? null;
}

export function getContinueForEpisode(
  episodeId: string,
): ContinueWatchEntry | null {
  return readContinueWatching().find((e) => e.episodeId === episodeId) ?? null;
}

export function upsertContinueWatching(input: {
  dramaId: string;
  episodeId: string;
  episodeNumber: number;
  positionSec: number;
  durationSec: number;
}): void {
  const duration = Math.max(0, input.durationSec);
  const position = Math.max(0, Math.min(input.positionSec, duration || input.positionSec));
  if (duration > 0 && position / duration >= CONTINUE_COMPLETE_RATIO) {
    removeContinueWatching(input.dramaId);
    return;
  }
  if (position < CONTINUE_MIN_SECONDS) return;

  const next: ContinueWatchEntry = {
    dramaId: input.dramaId,
    episodeId: input.episodeId,
    episodeNumber: input.episodeNumber,
    positionSec: position,
    durationSec: duration,
    updatedAt: new Date().toISOString(),
  };

  const rest = readContinueWatching().filter((e) => e.dramaId !== input.dramaId);
  writeAll([next, ...rest]);
}

export function removeContinueWatching(dramaId: string): void {
  const next = readContinueWatching().filter((e) => e.dramaId !== dramaId);
  writeAll(next);
}

export function clearContinueWatching(): void {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    emitChange();
  } catch {
    /* ignore */
  }
}

export function subscribeContinueWatching(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onChange();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function formatRemaining(entry: ContinueWatchEntry): string {
  if (!entry.durationSec || entry.durationSec <= 0) return "Continue";
  const left = Math.max(0, Math.round(entry.durationSec - entry.positionSec));
  if (left < 60) return `${left}s left`;
  const m = Math.floor(left / 60);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m left`;
}

export function continueProgressRatio(entry: ContinueWatchEntry): number {
  if (!entry.durationSec || entry.durationSec <= 0) return 0;
  return Math.max(0, Math.min(1, entry.positionSec / entry.durationSec));
}
