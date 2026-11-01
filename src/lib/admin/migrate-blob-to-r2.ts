import {
  loadUploadsCatalog,
  saveUploadsCatalog,
  upsertUploadsCatalog,
} from "@/lib/uploads-catalog";
import { isVercelBlobUrl } from "@/lib/media-url";
import {
  episodeObjectKey,
  isR2Configured,
  isR2PublicUrl,
  r2ListObjects,
  r2PutObject,
} from "@/lib/r2";
import type { Video } from "@/lib/types";

export type MigrateCandidate = {
  videoId: string;
  dramaId: string;
  episodeNumber: number;
  title: string;
  blobUrl: string;
  pathname: string | null;
  size: number;
  alreadyOnR2: boolean;
};

export type MigratePreview = {
  ok: boolean;
  r2Configured: boolean;
  blobConfigured: boolean;
  totalBlobEpisodes: number;
  alreadyOnR2: number;
  pending: number;
  pendingBytes: number;
  candidates: MigrateCandidate[];
  message: string;
};

export type MigrateResultItem = {
  videoId: string;
  dramaId: string;
  episodeNumber: number;
  from: string;
  to?: string;
  bytes?: number;
  status: "migrated" | "skipped" | "error";
  error?: string;
};

export type MigrateBatchResult = {
  ok: boolean;
  migrated: number;
  skipped: number;
  failed: number;
  remaining: number;
  bytesCopied: number;
  items: MigrateResultItem[];
  message: string;
  readBlocked?: boolean;
};

function pathnameFromBlobUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // https://xxx.public.blob.vercel-storage.com/slop/drama_x/ep-01-file.mp4
    const path = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
    return path || null;
  } catch {
    return null;
  }
}

async function listBlobVideos() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  const { list } = await import("@vercel/blob");
  const all: Array<{
    url: string;
    pathname: string;
    size: number;
  }> = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "slop/", limit: 1000, cursor });
    for (const b of page.blobs) {
      if (!/\.(mp4|mov|webm|m4v)$/i.test(b.pathname)) continue;
      if (b.pathname.includes("catalog/")) continue;
      all.push({
        url: b.url,
        pathname: b.pathname,
        size: b.size || 0,
      });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return all;
}

async function readBlobBytes(
  urlOrPathname: string,
): Promise<{ body: Buffer; contentType: string; size: number }> {
  const { get } = await import("@vercel/blob");

  // Authenticated SDK read — may still work when public CDN is suspended.
  try {
    const result = await get(urlOrPathname, {
      access: "public",
      useCache: false,
    });
    if (result?.statusCode === 200 && result.stream) {
      const body = await streamToBuffer(result.stream);
      return {
        body,
        contentType: result.blob.contentType || "video/mp4",
        size: result.blob.size || body.length,
      };
    }
  } catch {
    // fall through to public fetch
  }

  const res = await fetch(urlOrPathname, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!res.ok) {
    const textProbe = await res.text().catch(() => "");
    if (/store (is )?blocked|has been suspended|limits-exceeded/i.test(textProbe)) {
      throw new Error(
        "Vercel Blob reads are blocked/suspended — cannot copy bytes. Temporarily restore the Blob store, run migrate, then you can leave Blob suspended.",
      );
    }
    throw new Error(
      `Blob read failed (HTTP ${res.status}). Store may be suspended.`,
    );
  }
  const contentType = res.headers.get("content-type") || "video/mp4";
  if (/text\/|json|html/i.test(contentType)) {
    const textProbe = await res.text().catch(() => "");
    if (/store (is )?blocked|has been suspended|limits-exceeded/i.test(textProbe)) {
      throw new Error(
        "Vercel Blob reads are blocked/suspended — cannot copy bytes. Temporarily restore the Blob store, run migrate, then you can leave Blob suspended.",
      );
    }
    throw new Error(
      `Blob returned unexpected content-type ${contentType} instead of video.`,
    );
  }
  const ab = await res.arrayBuffer();
  return {
    body: Buffer.from(ab),
    contentType,
    size: ab.byteLength,
  };
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

export async function previewBlobToR2Migration(): Promise<MigratePreview> {
  const r2Configured = isR2Configured();
  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (!r2Configured) {
    return {
      ok: false,
      r2Configured,
      blobConfigured,
      totalBlobEpisodes: 0,
      alreadyOnR2: 0,
      pending: 0,
      pendingBytes: 0,
      candidates: [],
      message:
        "Configure Cloudflare R2 first (R2_* env vars), then migrate existing Blob episodes without reuploading.",
    };
  }
  if (!blobConfigured) {
    return {
      ok: false,
      r2Configured,
      blobConfigured,
      totalBlobEpisodes: 0,
      alreadyOnR2: 0,
      pending: 0,
      pendingBytes: 0,
      candidates: [],
      message: "BLOB_READ_WRITE_TOKEN is not set — nothing to migrate from.",
    };
  }

  const [catalog, blobs, r2Objects] = await Promise.all([
    loadUploadsCatalog(),
    listBlobVideos(),
    r2ListObjects("slop/"),
  ]);

  const r2Keys = new Set(r2Objects.map((o) => o.key));
  const blobByDramaEp = new Map<string, (typeof blobs)[0]>();
  for (const b of blobs) {
    const m = b.pathname.match(/^slop\/([^/]+)\/ep-0*(\d+)/i);
    if (!m) continue;
    const key = `${m[1]}:${Number(m[2])}`;
    const prev = blobByDramaEp.get(key);
    // Prefer larger / later listing entry as "latest"
    if (!prev || b.size >= prev.size) blobByDramaEp.set(key, b);
  }

  const candidates: MigrateCandidate[] = [];

  for (const video of catalog.videos || []) {
    const onR2 = isR2PublicUrl(video.videoUrl);
    const blobUrl = isVercelBlobUrl(video.videoUrl)
      ? video.videoUrl
      : blobByDramaEp.get(`${video.dramaId}:${video.episodeNumber}`)?.url;

    if (!blobUrl && onR2) continue; // already R2-only
    if (!blobUrl) continue; // no blob source

    const blobMeta =
      blobByDramaEp.get(`${video.dramaId}:${video.episodeNumber}`) || null;
    const pathname = blobMeta?.pathname || pathnameFromBlobUrl(blobUrl);
    const size = blobMeta?.size || 0;

    // Heuristic: same drama/ep already copied under slop/{drama}/ep-{nn}
    const ep = String(video.episodeNumber).padStart(2, "0");
    const prefix = `slop/${video.dramaId}/ep-${ep}`;
    const hasR2Copy =
      onR2 ||
      [...r2Keys].some(
        (k) => k.startsWith(prefix) || k.startsWith(`slop/${video.dramaId}/ep-${video.episodeNumber}`),
      );

    candidates.push({
      videoId: video.id,
      dramaId: video.dramaId,
      episodeNumber: video.episodeNumber,
      title: video.title,
      blobUrl,
      pathname,
      size,
      alreadyOnR2: hasR2Copy && onR2,
    });
  }

  // Also include Blob files that match known dramas but catalog still points at Blob
  const pending = candidates.filter((c) => !c.alreadyOnR2);
  const alreadyOnR2 = candidates.filter((c) => c.alreadyOnR2).length;

  return {
    ok: true,
    r2Configured,
    blobConfigured,
    totalBlobEpisodes: candidates.length,
    alreadyOnR2,
    pending: pending.length,
    pendingBytes: pending.reduce((s, c) => s + c.size, 0),
    candidates: pending,
    message:
      pending.length === 0
        ? alreadyOnR2 > 0
          ? "All Blob catalog episodes already point at R2. Dual storage can stay — new uploads use R2."
          : "No Blob-hosted catalog episodes found to migrate."
        : `${pending.length} episode${pending.length === 1 ? "" : "s"} can be copied Blob → R2 without reupload. Catalog URLs update automatically; Blob files stay until you purge.`,
  };
}

export async function migrateBlobToR2Batch(opts?: {
  limit?: number;
  deleteFromBlob?: boolean;
}): Promise<MigrateBatchResult> {
  const limit = Math.max(1, Math.min(opts?.limit ?? 2, 5));
  const deleteFromBlob = Boolean(opts?.deleteFromBlob);

  const preview = await previewBlobToR2Migration();
  if (!preview.ok) {
    return {
      ok: false,
      migrated: 0,
      skipped: 0,
      failed: 0,
      remaining: 0,
      bytesCopied: 0,
      items: [],
      message: preview.message,
    };
  }

  const batch = preview.candidates.slice(0, limit);
  if (batch.length === 0) {
    return {
      ok: true,
      migrated: 0,
      skipped: 0,
      failed: 0,
      remaining: 0,
      bytesCopied: 0,
      items: [],
      message: preview.message,
    };
  }

  const catalog = await loadUploadsCatalog();
  const updatedVideos: Video[] = [];
  const items: MigrateResultItem[] = [];
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  let bytesCopied = 0;
  let readBlocked = false;

  for (const candidate of batch) {
    const existing = catalog.videos.find((v) => v.id === candidate.videoId);
    if (!existing) {
      skipped += 1;
      items.push({
        videoId: candidate.videoId,
        dramaId: candidate.dramaId,
        episodeNumber: candidate.episodeNumber,
        from: candidate.blobUrl,
        status: "skipped",
        error: "Not in catalog",
      });
      continue;
    }

    if (isR2PublicUrl(existing.videoUrl)) {
      skipped += 1;
      items.push({
        videoId: candidate.videoId,
        dramaId: candidate.dramaId,
        episodeNumber: candidate.episodeNumber,
        from: candidate.blobUrl,
        to: existing.videoUrl,
        status: "skipped",
      });
      continue;
    }

    try {
      const source = candidate.pathname || candidate.blobUrl;
      const { body, contentType, size } = await readBlobBytes(source);
      const filename =
        candidate.pathname?.split("/").pop() ||
        `ep-${candidate.episodeNumber}.mp4`;
      const key = episodeObjectKey(
        candidate.dramaId,
        candidate.episodeNumber,
        filename,
      );
      const put = await r2PutObject({
        key,
        body,
        contentType,
        cacheControl: "public, max-age=31536000, immutable",
      });

      updatedVideos.push({
        ...existing,
        videoUrl: put.url,
      });

      if (deleteFromBlob && process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          const { del } = await import("@vercel/blob");
          await del(candidate.blobUrl);
        } catch {
          // Keep Blob copy if delete fails — dual mode is fine.
        }
      }

      migrated += 1;
      bytesCopied += size;
      items.push({
        videoId: candidate.videoId,
        dramaId: candidate.dramaId,
        episodeNumber: candidate.episodeNumber,
        from: candidate.blobUrl,
        to: put.url,
        bytes: size,
        status: "migrated",
      });
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : "Migrate failed";
      if (/suspended|blocked|cannot copy/i.test(message)) readBlocked = true;
      items.push({
        videoId: candidate.videoId,
        dramaId: candidate.dramaId,
        episodeNumber: candidate.episodeNumber,
        from: candidate.blobUrl,
        status: "error",
        error: message,
      });
      // Stop the batch early if Blob reads are hard-blocked — remaining will fail the same way.
      if (readBlocked) break;
    }
  }

  if (updatedVideos.length > 0) {
    const next = upsertUploadsCatalog(catalog, { videos: updatedVideos });
    await saveUploadsCatalog(next);
  }

  const remaining = Math.max(0, preview.pending - migrated - skipped);

  return {
    ok: failed === 0 || migrated > 0,
    migrated,
    skipped,
    failed,
    remaining: readBlocked ? preview.pending - migrated : remaining,
    bytesCopied,
    items,
    readBlocked,
    message: readBlocked
      ? `Copied ${migrated} file(s), then Blob reads blocked. Restore/unsuspend the Vercel Blob store temporarily, run migrate again — no reupload needed — then you can leave Blob suspended.`
      : migrated > 0
        ? `Migrated ${migrated} episode${migrated === 1 ? "" : "s"} to R2 (${formatBytes(bytesCopied)}). ${Math.max(0, preview.pending - migrated)} remaining. Catalog updated; original Blob files kept (dual storage).`
        : failed > 0
          ? `Migration failed for ${failed} file(s).`
          : "Nothing migrated.",
  };
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
