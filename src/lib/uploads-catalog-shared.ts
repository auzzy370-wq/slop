import type { Drama, Video } from "@/lib/types";

export const UPLOADS_BLOB_PATH = "slop/catalog/uploads.json";

export type UploadsCatalog = {
  version: 1;
  updatedAt: string;
  dramas: Drama[];
  videos: Video[];
};

export function emptyUploadsCatalog(): UploadsCatalog {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    dramas: [],
    videos: [],
  };
}

/** Merge seed catalog with admin-uploaded dramas/episodes. Uploads win on conflicts. */
export function mergeSeedWithUploads(
  seedVideos: Video[],
  seedDramas: Drama[],
  uploads: UploadsCatalog | null | undefined,
): { videos: Video[]; dramas: Drama[] } {
  if (!uploads || (uploads.videos.length === 0 && uploads.dramas.length === 0)) {
    return { videos: seedVideos, dramas: seedDramas };
  }

  const uploadEpKeys = new Set(
    uploads.videos.map((v) => `${v.dramaId}:${v.episodeNumber}`),
  );
  const uploadVideoIds = new Set(uploads.videos.map((v) => v.id));

  const videos = [
    ...seedVideos.filter(
      (v) =>
        !uploadVideoIds.has(v.id) &&
        !uploadEpKeys.has(`${v.dramaId}:${v.episodeNumber}`),
    ),
    ...uploads.videos,
  ];

  const dramaMap = new Map<string, Drama>();
  for (const d of seedDramas) dramaMap.set(d.id, d);
  for (const d of uploads.dramas) dramaMap.set(d.id, d);

  for (const d of dramaMap.values()) {
    const maxEp = videos
      .filter((v) => v.dramaId === d.id && v.status === "published")
      .reduce((m, v) => Math.max(m, v.episodeNumber), 0);
    if (maxEp > (d.episodeCount || 0)) {
      dramaMap.set(d.id, { ...d, episodeCount: maxEp });
    }
  }

  return { videos, dramas: [...dramaMap.values()] };
}

export function upsertUploadsCatalog(
  current: UploadsCatalog,
  patch: { dramas?: Drama[]; videos?: Video[] },
): UploadsCatalog {
  const dramaMap = new Map(current.dramas.map((d) => [d.id, d]));
  for (const d of patch.dramas ?? []) dramaMap.set(d.id, d);

  const videoMap = new Map(current.videos.map((v) => [v.id, v]));
  for (const v of patch.videos ?? []) {
    for (const [id, existing] of [...videoMap.entries()]) {
      if (
        existing.dramaId === v.dramaId &&
        existing.episodeNumber === v.episodeNumber &&
        existing.id !== v.id
      ) {
        videoMap.delete(id);
      }
    }
    videoMap.set(v.id, v);
  }

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    dramas: [...dramaMap.values()],
    videos: [...videoMap.values()].sort(
      (a, b) =>
        a.dramaId.localeCompare(b.dramaId) ||
        a.episodeNumber - b.episodeNumber,
    ),
  };
}
