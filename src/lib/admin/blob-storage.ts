import { loadUploadsCatalog } from "@/lib/uploads-catalog";

export type BlobVideoFile = {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: string | null;
  dramaId: string | null;
  episodeNumber: number | null;
};

export type StorageDramaBucket = {
  dramaId: string;
  title: string;
  files: number;
  uniqueEpisodes: number;
  bytes: number;
  inCatalogEpisodes: number;
};

export type StorageReport = {
  configured: boolean;
  totals: {
    objects: number;
    videos: number;
    bytes: number;
    videoBytes: number;
  };
  catalog: {
    dramas: number;
    videos: number;
  };
  dramas: StorageDramaBucket[];
  orphans: {
    files: number;
    bytes: number;
  };
  duplicates: {
    files: number;
    bytes: number;
  };
  reclaimableBytes: number;
  activeBytes: number;
};

export type PurgePlanItem = {
  pathname: string;
  url: string;
  size: number;
  reason: "orphan_drama" | "duplicate" | "tombstoned";
};

function fmtEpisodeMatch(pathname: string) {
  const m = pathname.match(/^slop\/([^/]+)\/ep-0*(\d+)/i);
  if (!m) return { dramaId: null as string | null, episodeNumber: null as number | null };
  return { dramaId: m[1], episodeNumber: Number(m[2]) };
}

async function listSlopBlobs() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  const { list } = await import("@vercel/blob");
  const all: Awaited<ReturnType<typeof list>>["blobs"] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "slop/", limit: 1000, cursor });
    all.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return all;
}

export async function getStorageReport(): Promise<StorageReport> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      configured: false,
      totals: { objects: 0, videos: 0, bytes: 0, videoBytes: 0 },
      catalog: { dramas: 0, videos: 0 },
      dramas: [],
      orphans: { files: 0, bytes: 0 },
      duplicates: { files: 0, bytes: 0 },
      reclaimableBytes: 0,
      activeBytes: 0,
    };
  }

  const [blobs, catalog] = await Promise.all([
    listSlopBlobs(),
    loadUploadsCatalog(),
  ]);

  const videos = blobs.filter((b) => /\.(mp4|mov|webm)$/i.test(b.pathname));
  const catalogKeys = new Set(
    (catalog.videos || []).map((v) => `${v.dramaId}:${v.episodeNumber}`),
  );
  const deletedKeys = new Set(catalog.deletedEpisodeKeys || []);
  const catalogUrlByKey = new Map(
    (catalog.videos || []).map((v) => [
      `${v.dramaId}:${v.episodeNumber}`,
      v.videoUrl,
    ]),
  );
  const dramaTitle = new Map(
    (catalog.dramas || []).map((d) => [d.id, d.title] as const),
  );
  const catalogEpsByDrama = new Map<string, number>();
  for (const v of catalog.videos || []) {
    catalogEpsByDrama.set(
      v.dramaId,
      (catalogEpsByDrama.get(v.dramaId) ?? 0) + 1,
    );
  }

  const byDramaFiles = new Map<string, BlobVideoFile[]>();
  for (const b of videos) {
    const { dramaId, episodeNumber } = fmtEpisodeMatch(b.pathname);
    const file: BlobVideoFile = {
      pathname: b.pathname,
      url: b.url,
      size: b.size || 0,
      uploadedAt: b.uploadedAt ? String(b.uploadedAt) : null,
      dramaId,
      episodeNumber,
    };
    const key = dramaId || "(unknown)";
    const list = byDramaFiles.get(key) || [];
    list.push(file);
    byDramaFiles.set(key, list);
  }

  let orphanBytes = 0;
  let orphanFiles = 0;
  let dupBytes = 0;
  let dupFiles = 0;
  let activeBytes = 0;

  for (const [, files] of byDramaFiles) {
    const byEp = new Map<number, BlobVideoFile[]>();
    for (const f of files) {
      if (f.episodeNumber == null) continue;
      const arr = byEp.get(f.episodeNumber) || [];
      arr.push(f);
      byEp.set(f.episodeNumber, arr);
    }
    for (const [ep, arr] of byEp) {
      const dramaId = arr[0]?.dramaId;
      if (!dramaId) continue;
      const key = `${dramaId}:${ep}`;
      const inCatalog = catalogKeys.has(key);
      const tombstoned = deletedKeys.has(key);
      if (!inCatalog || tombstoned) {
        orphanFiles += arr.length;
        orphanBytes += arr.reduce((s, f) => s + f.size, 0);
        continue;
      }
      const keepUrl = catalogUrlByKey.get(key);
      const keep =
        arr.find((f) => keepUrl && f.url === keepUrl) ||
        [...arr].sort(
          (a, b) =>
            new Date(b.uploadedAt || 0).getTime() -
            new Date(a.uploadedAt || 0).getTime(),
        )[0];
      for (const f of arr) {
        if (f.url === keep.url) activeBytes += f.size;
        else {
          dupFiles += 1;
          dupBytes += f.size;
        }
      }
    }
  }

  const dramas: StorageDramaBucket[] = [...byDramaFiles.entries()]
    .map(([dramaId, files]) => {
      const eps = new Set(
        files
          .map((f) => f.episodeNumber)
          .filter((n): n is number => n != null),
      );
      return {
        dramaId,
        title: dramaTitle.get(dramaId) || "(not in catalog)",
        files: files.length,
        uniqueEpisodes: eps.size,
        bytes: files.reduce((s, f) => s + f.size, 0),
        inCatalogEpisodes: catalogEpsByDrama.get(dramaId) ?? 0,
      };
    })
    .sort((a, b) => b.bytes - a.bytes);

  const videoBytes = videos.reduce((s, b) => s + (b.size || 0), 0);
  const bytes = blobs.reduce((s, b) => s + (b.size || 0), 0);

  return {
    configured: true,
    totals: {
      objects: blobs.length,
      videos: videos.length,
      bytes,
      videoBytes,
    },
    catalog: {
      dramas: catalog.dramas?.length ?? 0,
      videos: catalog.videos?.length ?? 0,
    },
    dramas,
    orphans: { files: orphanFiles, bytes: orphanBytes },
    duplicates: { files: dupFiles, bytes: dupBytes },
    reclaimableBytes: orphanBytes + dupBytes,
    activeBytes,
  };
}

export async function planOrphanPurge(): Promise<PurgePlanItem[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  const [blobs, catalog] = await Promise.all([
    listSlopBlobs(),
    loadUploadsCatalog(),
  ]);
  const videos = blobs.filter((b) => /\.(mp4|mov|webm)$/i.test(b.pathname));
  const catalogKeys = new Set(
    (catalog.videos || []).map((v) => `${v.dramaId}:${v.episodeNumber}`),
  );
  const deletedKeys = new Set(catalog.deletedEpisodeKeys || []);
  const catalogUrlByKey = new Map(
    (catalog.videos || []).map((v) => [
      `${v.dramaId}:${v.episodeNumber}`,
      v.videoUrl,
    ]),
  );

  const byKey = new Map<string, typeof videos>();
  for (const b of videos) {
    const { dramaId, episodeNumber } = fmtEpisodeMatch(b.pathname);
    if (!dramaId || episodeNumber == null) continue;
    const key = `${dramaId}:${episodeNumber}`;
    const arr = byKey.get(key) || [];
    arr.push(b);
    byKey.set(key, arr);
  }

  const toDelete: PurgePlanItem[] = [];
  for (const [key, files] of byKey) {
    const inCatalog = catalogKeys.has(key);
    const tombstoned = deletedKeys.has(key);
    if (!inCatalog || tombstoned) {
      for (const f of files) {
        toDelete.push({
          pathname: f.pathname,
          url: f.url,
          size: f.size || 0,
          reason: tombstoned ? "tombstoned" : "orphan_drama",
        });
      }
      continue;
    }
    const keepUrl = catalogUrlByKey.get(key);
    const keep =
      files.find((f) => keepUrl && f.url === keepUrl) ||
      [...files].sort(
        (a, b) =>
          new Date(b.uploadedAt || 0).getTime() -
          new Date(a.uploadedAt || 0).getTime(),
      )[0];
    for (const f of files) {
      if (f.url !== keep.url) {
        toDelete.push({
          pathname: f.pathname,
          url: f.url,
          size: f.size || 0,
          reason: "duplicate",
        });
      }
    }
  }
  return toDelete;
}

export async function purgeOrphanBlobs(): Promise<{
  deleted: number;
  deletedBytes: number;
  errors: string[];
}> {
  const plan = await planOrphanPurge();
  if (!plan.length) {
    return { deleted: 0, deletedBytes: 0, errors: [] };
  }
  const { del } = await import("@vercel/blob");
  let deleted = 0;
  let deletedBytes = 0;
  const errors: string[] = [];
  const BATCH = 25;
  for (let i = 0; i < plan.length; i += BATCH) {
    const batch = plan.slice(i, i + BATCH);
    try {
      await del(batch.map((b) => b.url));
      deleted += batch.length;
      deletedBytes += batch.reduce((s, b) => s + b.size, 0);
    } catch {
      for (const b of batch) {
        try {
          await del(b.url);
          deleted += 1;
          deletedBytes += b.size;
        } catch (err) {
          errors.push(
            err instanceof Error
              ? `${b.pathname}: ${err.message}`
              : `${b.pathname}: delete failed`,
          );
        }
      }
    }
  }
  return { deleted, deletedBytes, errors };
}
