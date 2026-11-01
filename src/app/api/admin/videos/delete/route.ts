import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import { deleteEpisodeMedia } from "@/lib/episodes/delete-media";
import {
  loadUploadsCatalog,
  removeVideoFromUploadsCatalog,
  saveUploadsCatalog,
} from "@/lib/uploads-catalog";

/**
 * Permanently remove an episode from the shared uploads catalog AND delete
 * its MP4 from Vercel Blob / local public/uploads so it stops using storage.
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

    const media = await deleteEpisodeMedia({
      videoUrl: removed?.videoUrl || body.videoUrl || null,
      dramaId,
      episodeNumber,
    });

    const filesRemoved =
      media.deletedUrls.length + media.deletedPaths.length;
    const storageFreed = filesRemoved > 0;

    return NextResponse.json({
      ok: true,
      videoId,
      removedFromCatalog: inCatalog || Boolean(removed),
      storageFreed,
      filesRemoved,
      deletedUrls: media.deletedUrls,
      deletedPaths: media.deletedPaths.map((p) =>
        p.replace(process.cwd(), ""),
      ),
      mediaErrors: media.errors,
      videoCount: catalog.videos.length,
      updatedAt: catalog.updatedAt,
      message: storageFreed
        ? `Episode deleted and ${filesRemoved} video file${filesRemoved === 1 ? "" : "s"} removed from storage.`
        : media.errors.length
          ? "Episode removed from catalog, but the video file could not be deleted."
          : "Episode deleted from catalog.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json(
      { error: "delete_failed", message },
      { status: 500 },
    );
  }
}
