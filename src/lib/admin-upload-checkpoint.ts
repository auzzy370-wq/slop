/** Durable mass-upload progress so phone/browser closes can resume. */

export type UploadCheckpoint = {
  dramaId: string;
  dramaTitle: string;
  cloudTarget: "auto" | "r2" | "supabase" | "blob" | "local";
  publishStatus: string;
  /** Episode numbers successfully saved to catalog this run / prior runs. */
  completedEpisodeNumbers: number[];
  /** Original filenames for completed eps (best-effort match on resume). */
  completedFiles: Array<{ episodeNumber: number; name: string }>;
  totalPlanned: number;
  updatedAt: string;
};

const KEY = "slop_upload_checkpoint_v1";

export function loadUploadCheckpoint(): UploadCheckpoint | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UploadCheckpoint;
    if (!parsed?.dramaId || !Array.isArray(parsed.completedEpisodeNumbers)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveUploadCheckpoint(cp: UploadCheckpoint) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cp));
  } catch {
    /* quota / private mode */
  }
}

export function clearUploadCheckpoint() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function markCheckpointEpisodeDone(input: {
  dramaId: string;
  dramaTitle: string;
  cloudTarget: "auto" | "r2" | "supabase" | "blob" | "local";
  publishStatus: string;
  episodeNumber: number;
  fileName: string;
  totalPlanned: number;
}) {
  const prev = loadUploadCheckpoint();
  const same = prev?.dramaId === input.dramaId;
  const completed = new Set(
    same ? prev?.completedEpisodeNumbers || [] : [],
  );
  completed.add(input.episodeNumber);
  const completedFiles = same
    ? [...(prev?.completedFiles || [])].filter(
        (f) => f.episodeNumber !== input.episodeNumber,
      )
    : [];
  completedFiles.push({
    episodeNumber: input.episodeNumber,
    name: input.fileName,
  });
  saveUploadCheckpoint({
    dramaId: input.dramaId,
    dramaTitle: input.dramaTitle,
    cloudTarget: input.cloudTarget,
    publishStatus: input.publishStatus,
    completedEpisodeNumbers: [...completed].sort((a, b) => a - b),
    completedFiles,
    totalPlanned: Math.max(input.totalPlanned, completed.size),
    updatedAt: new Date().toISOString(),
  });
}
