import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import { deleteEpisodeMedia } from "@/lib/episodes/delete-media";
import {
  loadUploadsCatalog,
  removeVideoFromUploadsCatalog,
  saveUploadsCatalog,
} from "@/lib/uploads-catalog";

type DeleteItem = {
  videoId: string;
  videoUrl?: string | null;
  dramaId?: string | null;
  episodeNumber?: number | null;
};

type DeleteResult = {
  videoId: string;
  ok: boolean;
  removedFromCatalog: boolean;
  storageFreed: boolean;
  filesRemoved: number;
  mediaErrors: string[];
  message?: string;
};

async function deleteOne(
  item: DeleteItem,
  catalogIn: Awaited<ReturnType<typeof loadUploadsCatalog>>,
): Promise<{
  catalog: Awaited<ReturnType<typeof loadUploadsCatalog>>;
  result: DeleteResult;
}> {
  const videoId = item.videoId.trim();
  const inCatalog = catalogIn.videos.some((v) => v.id === videoId);
  const { catalog, removed } = removeVideoFromUploadsCatalog(
    catalogIn,
    videoId,
  );

  const deletedIds = new Set(catalog.deletedVideoIds ?? []);
  deletedIds.add(videoId);
  catalog.deletedVideoIds = [...deletedIds];

  const dramaId = removed?.dramaId || item.dramaId?.trim() || null;
  const episodeNumber =
    removed?.episodeNumber ??
    (typeof item.episodeNumber === "number" ? item.episodeNumber : null);
  if (dramaId && episodeNumber != null) {
    const deletedKeys = new Set(catalog.deletedEpisodeKeys ?? []);
    deletedKeys.add(`${dramaId}:${episodeNumber}`);
    catalog.deletedEpisodeKeys = [...deletedKeys];
  }
  catalog.updatedAt = new Date().toISOString();

  const media = await deleteEpisodeMedia({
    videoUrl: removed?.videoUrl || item.videoUrl || null,
    dramaId,
    episodeNumber,
  });

  const filesRemoved = media.deletedUrls.length + media.deletedPaths.length;
  const storageFreed = filesRemoved > 0;

  return {
    catalog,
    result: {
      videoId,
      ok: true,
      removedFromCatalog: inCatalog || Boolean(removed),
      storageFreed,
      filesRemoved,
      mediaErrors: media.errors,
      message: storageFreed
        ? `Episode deleted and ${filesRemoved} video file${filesRemoved === 1 ? "" : "s"} removed from storage.`
        : media.errors.length
          ? "Episode removed from catalog, but the video file could not be deleted."
          : "Episode deleted from catalog.",
    },
  };
}

/**
 * Permanently remove episode(s) from the shared uploads catalog AND delete
 * MP4(s) from Vercel Blob / local public/uploads so they stop using storage.
 *
 * Accepts either:
 * - `{ videoId, videoUrl?, dramaId?, episodeNumber? }` — single delete
 * - `{ videoIds: string[] }` or `{ videos: DeleteItem[] }` — bulk delete
 */
export async function POST(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;

  let body: {
    videoId?: string;
    videoIds?: string[];
    videos?: DeleteItem[];
    videoUrl?: string | null;
    dramaId?: string | null;
    episodeNumber?: number | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const items: DeleteItem[] = [];
  if (Array.isArray(body.videos) && body.videos.length > 0) {
    for (const v of body.videos) {
      if (v?.videoId?.trim()) items.push({ ...v, videoId: v.videoId.trim() });
    }
  } else if (Array.isArray(body.videoIds) && body.videoIds.length > 0) {
    for (const id of body.videoIds) {
      if (typeof id === "string" && id.trim()) {
        items.push({ videoId: id.trim() });
      }
    }
  } else if (body.videoId?.trim()) {
    items.push({
      videoId: body.videoId.trim(),
      videoUrl: body.videoUrl,
      dramaId: body.dramaId,
      episodeNumber: body.episodeNumber,
    });
  }

  if (!items.length) {
    return NextResponse.json(
      {
        error: "missing_video_id",
        message: "videoId, videoIds, or videos is required",
      },
      { status: 400 },
    );
  }

  // Deduplicate by videoId while preserving first occurrence's metadata
  const seen = new Set<string>();
  const unique: DeleteItem[] = [];
  for (const item of items) {
    if (seen.has(item.videoId)) continue;
    seen.add(item.videoId);
    unique.push(item);
  }

  try {
    let catalog = await loadUploadsCatalog();
    const results: DeleteResult[] = [];

    for (const item of unique) {
      const { catalog: next, result } = await deleteOne(item, catalog);
      catalog = next;
      results.push(result);
    }

    await saveUploadsCatalog(catalog);

    const filesRemoved = results.reduce((s, r) => s + r.filesRemoved, 0);
    const storageFreed = filesRemoved > 0;
    const mediaErrors = results.flatMap((r) => r.mediaErrors);
    const deletedIds = results.filter((r) => r.ok).map((r) => r.videoId);

    if (unique.length === 1) {
      const r = results[0]!;
      return NextResponse.json({
        ok: true,
        videoId: r.videoId,
        removedFromCatalog: r.removedFromCatalog,
        storageFreed: r.storageFreed,
        filesRemoved: r.filesRemoved,
        mediaErrors: r.mediaErrors,
        videoCount: catalog.videos.length,
        updatedAt: catalog.updatedAt,
        message: r.message,
      });
    }

    return NextResponse.json({
      ok: true,
      bulk: true,
      deletedCount: deletedIds.length,
      deletedIds,
      results,
      storageFreed,
      filesRemoved,
      mediaErrors,
      videoCount: catalog.videos.length,
      updatedAt: catalog.updatedAt,
      message: `Deleted ${deletedIds.length} episode${deletedIds.length === 1 ? "" : "s"}${
        storageFreed
          ? ` and removed ${filesRemoved} file${filesRemoved === 1 ? "" : "s"} from storage`
          : ""
      }.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json(
      { error: "delete_failed", message },
      { status: 500 },
    );
  }
}
