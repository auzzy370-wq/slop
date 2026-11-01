import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Drama, Video } from "@/lib/types";
import {
  emptyUploadsCatalog,
  episodeKey,
  removeVideoFromUploadsCatalog,
  UPLOADS_BLOB_PATH,
  upsertUploadsCatalog,
  type UploadsCatalog,
} from "@/lib/uploads-catalog-shared";
import {
  isR2Configured,
  r2GetObjectText,
  r2PutObject,
} from "@/lib/r2";
import { slugify, uid } from "@/lib/utils";

const UPLOADS_R2_KEY = UPLOADS_BLOB_PATH;

export {
  emptyUploadsCatalog,
  episodeKey,
  mergeSeedWithUploads,
  removeDramaFromUploadsCatalog,
  removeVideoFromUploadsCatalog,
  upsertUploadsCatalog,
  UPLOADS_BLOB_PATH,
  type UploadsCatalog,
} from "@/lib/uploads-catalog-shared";

const LOCAL_PATH = path.join(process.cwd(), "data", "uploads-catalog.json");

async function readLocalCatalog(): Promise<UploadsCatalog | null> {
  try {
    const raw = await readFile(LOCAL_PATH, "utf8");
    const parsed = JSON.parse(raw) as UploadsCatalog;
    if (!parsed || !Array.isArray(parsed.videos) || !Array.isArray(parsed.dramas)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeLocalCatalog(catalog: UploadsCatalog): Promise<void> {
  await mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await writeFile(LOCAL_PATH, JSON.stringify(catalog, null, 2), "utf8");
}

async function readBlobCatalog(): Promise<UploadsCatalog | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({
      prefix: UPLOADS_BLOB_PATH,
      limit: 10,
    });
    const hit =
      blobs.find((b) => b.pathname === UPLOADS_BLOB_PATH) ?? blobs[0];
    if (!hit?.url) return null;
    // Bust CDN — stale catalog reads during mass upload caused lost episodes.
    const bust = `t=${Date.now()}`;
    const url = hit.url.includes("?") ? `${hit.url}&${bust}` : `${hit.url}?${bust}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    if (!res.ok) return null;
    const parsed = (await res.json()) as UploadsCatalog;
    if (!parsed || !Array.isArray(parsed.videos) || !Array.isArray(parsed.dramas)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeBlobCatalog(catalog: UploadsCatalog): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const { put } = await import("@vercel/blob");
  const blob = await put(UPLOADS_BLOB_PATH, JSON.stringify(catalog), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
  return blob.url;
}

async function readR2Catalog(): Promise<UploadsCatalog | null> {
  if (!isR2Configured()) return null;
  try {
    const raw = await r2GetObjectText(UPLOADS_R2_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UploadsCatalog;
    if (!parsed || !Array.isArray(parsed.videos) || !Array.isArray(parsed.dramas)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeR2Catalog(catalog: UploadsCatalog): Promise<string | null> {
  if (!isR2Configured()) return null;
  const { url } = await r2PutObject({
    key: UPLOADS_R2_KEY,
    body: JSON.stringify(catalog),
    contentType: "application/json",
    cacheControl: "no-cache",
  });
  return url;
}

function pickNewerCatalog(
  a: UploadsCatalog | null,
  b: UploadsCatalog | null,
): UploadsCatalog | null {
  if (!a) return b;
  if (!b) return a;
  const at = Date.parse(a.updatedAt || "");
  const bt = Date.parse(b.updatedAt || "");
  if (Number.isFinite(at) && Number.isFinite(bt)) {
    return bt >= at ? b : a;
  }
  return (b.videos?.length ?? 0) >= (a.videos?.length ?? 0) ? b : a;
}

export async function loadUploadsCatalog(): Promise<UploadsCatalog> {
  // Prefer R2 when configured (Blob may be suspended); merge with Blob/local by updatedAt.
  const [fromR2, fromBlob, fromLocal] = await Promise.all([
    readR2Catalog(),
    readBlobCatalog(),
    readLocalCatalog(),
  ]);
  const cloud = pickNewerCatalog(fromR2, fromBlob);
  const best = pickNewerCatalog(cloud, fromLocal);
  if (best) return best;
  return emptyUploadsCatalog();
}

export async function saveUploadsCatalog(
  catalog: UploadsCatalog,
): Promise<{ ok: true; url?: string | null }> {
  let url: string | null = null;
  try {
    url = await writeR2Catalog(catalog);
  } catch (err) {
    console.error("r2 catalog write failed", err);
  }
  try {
    const blobUrl = await writeBlobCatalog(catalog);
    url = url || blobUrl;
  } catch (err) {
    console.error("blob catalog write failed", err);
  }
  try {
    await writeLocalCatalog(catalog);
  } catch (err) {
    if (!url) throw err;
  }
  return { ok: true, url };
}

type BlobEpisodeHit = {
  dramaId: string;
  episodeNumber: number;
  url: string;
  pathname: string;
};

/** Scan Vercel Blob for mass-uploaded MP4s and fill any gaps in the catalog. */
export async function rebuildUploadsCatalogFromBlobs(): Promise<{
  catalog: UploadsCatalog;
  added: number;
  scanned: number;
}> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }

  const { list } = await import("@vercel/blob");
  const current = await loadUploadsCatalog();
  const hits: BlobEpisodeHit[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({
      prefix: "slop/",
      limit: 1000,
      cursor,
    });
    for (const blob of page.blobs) {
      if (blob.pathname === UPLOADS_BLOB_PATH) continue;
      if (!/\.mp4$/i.test(blob.pathname)) continue;
      const m = blob.pathname.match(
        /^slop\/(drama_[^/]+)\/ep-0*(\d+)/i,
      );
      if (!m) continue;
      hits.push({
        dramaId: m[1],
        episodeNumber: Number(m[2]),
        url: blob.url,
        pathname: blob.pathname,
      });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  // Latest upload wins per drama+episode
  const latest = new Map<string, BlobEpisodeHit>();
  for (const hit of hits) {
    const key = `${hit.dramaId}:${hit.episodeNumber}`;
    latest.set(key, hit);
  }

  // Only heal dramas already tracked in the catalog — ignore leftover Blob
  // folders from abandoned upload attempts so we don't invent "Uploaded series".
  const knownDramaIds = new Set(current.dramas.map((d) => d.id));
  for (const v of current.videos) knownDramaIds.add(v.dramaId);
  const deletedKeys = new Set(current.deletedEpisodeKeys ?? []);
  const deletedIds = new Set(current.deletedVideoIds ?? []);

  const synthesized: Video[] = [];
  const now = new Date().toISOString();

  for (const hit of latest.values()) {
    if (!knownDramaIds.has(hit.dramaId)) continue;
    const key = episodeKey(hit.dramaId, hit.episodeNumber);
    if (deletedKeys.has(key)) continue;

    const existing = current.videos.find(
      (v) =>
        v.dramaId === hit.dramaId && v.episodeNumber === hit.episodeNumber,
    );
    if (existing) {
      if (deletedIds.has(existing.id)) continue;
      if (existing.videoUrl !== hit.url) {
        synthesized.push({ ...existing, videoUrl: hit.url });
      }
      continue;
    }

    const drama = current.dramas.find((d) => d.id === hit.dramaId);
    const title = drama?.title ?? "Uploaded series";
    synthesized.push({
      id: uid("ep"),
      slug: slugify(`${drama?.slug ?? hit.dramaId}-ep-${hit.episodeNumber}`),
      dramaId: hit.dramaId,
      episodeNumber: hit.episodeNumber,
      title: `Episode ${hit.episodeNumber}`,
      description: `${title} · Episode ${hit.episodeNumber}`,
      videoUrl: hit.url,
      thumbnailUrl: drama?.posterUrl || "/thumbnails/unsent-ep1.jpg",
      durationSeconds: 15,
      aspectRatio: "9:16",
      categoryIds: drama?.genreIds ?? [],
      tags: drama?.tags ?? [],
      status: "published",
      featured: false,
      pinned: false,
      sourceAttribution:
        drama?.sourceAttribution || drama?.title || title,
      licensingNotes: "Admin mass upload (rebuilt from Blob)",
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      saveCount: 0,
      createdAt: now,
      publishedAt: now,
      scheduledAt: null,
      commentsDisabled: false,
      playback: "video",
    });
  }

  if (synthesized.length === 0) {
    return { catalog: current, added: 0, scanned: latest.size };
  }

  const dramas = current.dramas.map((d) => {
    const maxEp = Math.max(
      0,
      d.episodeCount || 0,
      ...[...latest.values()]
        .filter(
          (h) =>
            h.dramaId === d.id &&
            !deletedKeys.has(episodeKey(h.dramaId, h.episodeNumber)),
        )
        .map((h) => h.episodeNumber),
      ...synthesized
        .filter((v) => v.dramaId === d.id)
        .map((v) => v.episodeNumber),
      ...current.videos
        .filter(
          (v) =>
            v.dramaId === d.id &&
            !deletedIds.has(v.id) &&
            !deletedKeys.has(episodeKey(v.dramaId, v.episodeNumber)),
        )
        .map((v) => v.episodeNumber),
    );
    return { ...d, episodeCount: maxEp };
  });

  const catalog = upsertUploadsCatalog(current, {
    dramas,
    videos: synthesized,
  });

  await saveUploadsCatalog(catalog);
  const added = synthesized.filter(
    (v) =>
      !current.videos.some(
        (c) =>
          c.dramaId === v.dramaId && c.episodeNumber === v.episodeNumber,
      ),
  ).length;
  return { catalog, added, scanned: latest.size };
}
