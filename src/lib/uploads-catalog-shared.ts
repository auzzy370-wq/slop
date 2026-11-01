import type { Drama, Video } from "@/lib/types";

export const UPLOADS_BLOB_PATH = "slop/catalog/uploads.json";

export type UploadsCatalog = {
  version: 1;
  updatedAt: string;
  dramas: Drama[];
  videos: Video[];
  /** Tombstones so Blob rescans / seed merges can't resurrect deleted episodes. */
  deletedEpisodeKeys?: string[];
  deletedVideoIds?: string[];
};

export function episodeKey(dramaId: string, episodeNumber: number) {
  return `${dramaId}:${episodeNumber}`;
}

export function emptyUploadsCatalog(): UploadsCatalog {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    dramas: [],
    videos: [],
    deletedEpisodeKeys: [],
    deletedVideoIds: [],
  };
}

/** Merge seed catalog with admin-uploaded dramas/episodes. Uploads win on conflicts. */
export function mergeSeedWithUploads(
  seedVideos: Video[],
  seedDramas: Drama[],
  uploads: UploadsCatalog | null | undefined,
): { videos: Video[]; dramas: Drama[] } {
  const deletedKeys = new Set(uploads?.deletedEpisodeKeys ?? []);
  const deletedIds = new Set(uploads?.deletedVideoIds ?? []);

  if (!uploads || (uploads.videos.length === 0 && uploads.dramas.length === 0)) {
    if (deletedKeys.size === 0 && deletedIds.size === 0) {
      return { videos: seedVideos, dramas: seedDramas };
    }
    return {
      videos: seedVideos.filter(
        (v) =>
          !deletedIds.has(v.id) &&
          !deletedKeys.has(episodeKey(v.dramaId, v.episodeNumber)),
      ),
      dramas: seedDramas,
    };
  }

  const uploadEpKeys = new Set(
    uploads.videos.map((v) => episodeKey(v.dramaId, v.episodeNumber)),
  );
  const uploadVideoIds = new Set(uploads.videos.map((v) => v.id));

  const videos = [
    ...seedVideos.filter(
      (v) =>
        !uploadVideoIds.has(v.id) &&
        !uploadEpKeys.has(episodeKey(v.dramaId, v.episodeNumber)) &&
        !deletedIds.has(v.id) &&
        !deletedKeys.has(episodeKey(v.dramaId, v.episodeNumber)),
    ),
    ...uploads.videos.filter(
      (v) =>
        !deletedIds.has(v.id) &&
        !deletedKeys.has(episodeKey(v.dramaId, v.episodeNumber)),
    ),
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

  const deletedKeys = new Set(current.deletedEpisodeKeys ?? []);
  const deletedIds = new Set(current.deletedVideoIds ?? []);
  const videoMap = new Map(current.videos.map((v) => [v.id, v]));
  for (const v of patch.videos ?? []) {
    // Re-uploading an episode clears its tombstone.
    deletedKeys.delete(episodeKey(v.dramaId, v.episodeNumber));
    deletedIds.delete(v.id);
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
    deletedEpisodeKeys: [...deletedKeys],
    deletedVideoIds: [...deletedIds],
  };
}

/** Remove an episode from the uploads overlay and tombstone it. */
export function removeVideoFromUploadsCatalog(
  current: UploadsCatalog,
  videoId: string,
): { catalog: UploadsCatalog; removed: Video | null } {
  const removed =
    current.videos.find((v) => v.id === videoId) ?? null;
  const videos = current.videos.filter((v) => v.id !== videoId);
  const deletedKeys = new Set(current.deletedEpisodeKeys ?? []);
  const deletedIds = new Set(current.deletedVideoIds ?? []);
  deletedIds.add(videoId);
  if (removed) {
    deletedKeys.add(episodeKey(removed.dramaId, removed.episodeNumber));
  }

  const dramas = current.dramas.map((d) => {
    if (!removed || d.id !== removed.dramaId) return d;
    const maxEp = videos
      .filter((v) => v.dramaId === d.id)
      .reduce((m, v) => Math.max(m, v.episodeNumber), 0);
    return { ...d, episodeCount: maxEp };
  });

  return {
    removed,
    catalog: {
      version: 1,
      updatedAt: new Date().toISOString(),
      dramas,
      videos: videos.sort(
        (a, b) =>
          a.dramaId.localeCompare(b.dramaId) ||
          a.episodeNumber - b.episodeNumber,
      ),
      deletedEpisodeKeys: [...deletedKeys],
      deletedVideoIds: [...deletedIds],
    },
  };
}

/**
 * Remove an entire series from the uploads catalog and tombstone every episode
 * so Blob/R2 rescans can't resurrect it. MP4 files are left in storage.
 */
export function removeDramaFromUploadsCatalog(
  current: UploadsCatalog,
  dramaId: string,
): {
  catalog: UploadsCatalog;
  removedDrama: Drama | null;
  removedVideos: Video[];
} {
  const removedDrama =
    current.dramas.find((d) => d.id === dramaId) ?? null;
  const removedVideos = current.videos.filter((v) => v.dramaId === dramaId);
  const deletedKeys = new Set(current.deletedEpisodeKeys ?? []);
  const deletedIds = new Set(current.deletedVideoIds ?? []);

  for (const v of removedVideos) {
    deletedIds.add(v.id);
    deletedKeys.add(episodeKey(v.dramaId, v.episodeNumber));
  }

  return {
    removedDrama,
    removedVideos,
    catalog: {
      version: 1,
      updatedAt: new Date().toISOString(),
      dramas: current.dramas.filter((d) => d.id !== dramaId),
      videos: current.videos
        .filter((v) => v.dramaId !== dramaId)
        .sort(
          (a, b) =>
            a.dramaId.localeCompare(b.dramaId) ||
            a.episodeNumber - b.episodeNumber,
        ),
      deletedEpisodeKeys: [...deletedKeys],
      deletedVideoIds: [...deletedIds],
    },
  };
}
