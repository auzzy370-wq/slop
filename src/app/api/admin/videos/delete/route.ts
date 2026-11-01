import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import {
  loadUploadsCatalog,
  removeVideoFromUploadsCatalog,
  saveUploadsCatalog,
} from "@/lib/uploads-catalog";

/**
 * Permanently remove an episode from the shared uploads catalog.
 * Also tombstones the drama:episode key so Blob rescans don't resurrect it,
 * and best-effort deletes the MP4 from Vercel Blob when the URL is ours.
 */
export async function POST(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;

  let body: {
    videoId?: string;
    videoUrl?: string | null;
    dramaId?: string | null;
    episodeNumber?: number | null;
  };
  try {
    body = (await request.json()) as {
      videoId?: string;
      videoUrl?: string | null;
      dramaId?: string | null;
      episodeNumber?: number | null;
    };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const videoId = body.videoId?.trim();
  if (!videoId) {
    return NextResponse.json(
      { error: "missing_video_id", message: "videoId is required" },
      { status: 400 },
    );
  }

  try {
    const current = await loadUploadsCatalog();
    const inCatalog = current.videos.some((v) => v.id === videoId);
    const { catalog, removed } = removeVideoFromUploadsCatalog(
      current,
      videoId,
    );

    // Tombstone seed/demo episodes too so refresh doesn't resurrect them.
    const deletedIds = new Set(catalog.deletedVideoIds ?? []);
    deletedIds.add(videoId);
    catalog.deletedVideoIds = [...deletedIds];
    const dramaId = removed?.dramaId || body.dramaId?.trim() || null;
    const episodeNumber =
      removed?.episodeNumber ??
      (typeof body.episodeNumber === "number" ? body.episodeNumber : null);
    if (dramaId && episodeNumber != null) {
      const deletedKeys = new Set(catalog.deletedEpisodeKeys ?? []);
      deletedKeys.add(`${dramaId}:${episodeNumber}`);
      catalog.deletedEpisodeKeys = [...deletedKeys];
    }
    catalog.updatedAt = new Date().toISOString();

    await saveUploadsCatalog(catalog);

    let blobDeleted = false;
    const url = removed?.videoUrl || body.videoUrl || null;
    if (
      url &&
      process.env.BLOB_READ_WRITE_TOKEN &&
      /vercel-storage\.com|blob\.vercel-storage\.com/i.test(url)
    ) {
      try {
        await del(url);
        blobDeleted = true;
      } catch (err) {
        console.error("blob delete failed", err);
      }
    }

    return NextResponse.json({
      ok: true,
      videoId,
      removedFromCatalog: inCatalog || Boolean(removed),
      blobDeleted,
      videoCount: catalog.videos.length,
      updatedAt: catalog.updatedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json(
      { error: "delete_failed", message },
      { status: 500 },
    );
  }
}
