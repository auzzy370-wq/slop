import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import type { Drama, Video } from "@/lib/types";
import {
  loadUploadsCatalog,
  rebuildUploadsCatalogFromBlobs,
  removeDramaFromUploadsCatalog,
  saveUploadsCatalog,
  upsertUploadsCatalog,
} from "@/lib/uploads-catalog";

/**
 * Persist admin mass-upload metadata so episodes survive refresh / new devices.
 * MP4 bytes live in Blob/R2 (or /public/uploads); this stores the catalog overlay.
 *
 * Body `{ rebuildFromBlobs: true }` rescans Blob MP4s and fills catalog gaps.
 * Body `{ action: "removeSeries", dramaId }` unpublishes by deleting the series
 * from the catalog (tombstones episodes; storage files are kept).
 */
export async function POST(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;

  let body: {
    action?: string;
    dramaId?: string;
    dramas?: Drama[];
    videos?: Video[];
    rebuildFromBlobs?: boolean;
  };
  try {
    body = (await request.json()) as {
      action?: string;
      dramaId?: string;
      dramas?: Drama[];
      videos?: Video[];
      rebuildFromBlobs?: boolean;
    };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.action === "removeSeries") {
    const dramaId = body.dramaId?.trim();
    if (!dramaId) {
      return NextResponse.json(
        { error: "missing_drama", message: "dramaId is required" },
        { status: 400 },
      );
    }
    try {
      const current = await loadUploadsCatalog();
      const result = removeDramaFromUploadsCatalog(current, dramaId);
      await saveUploadsCatalog(result.catalog);
      return NextResponse.json({
        ok: true,
        removed: true,
        dramaId,
        removedDramaTitle: result.removedDrama?.title ?? null,
        removedEpisodes: result.removedVideos.length,
        dramaCount: result.catalog.dramas.length,
        videoCount: result.catalog.videos.length,
        updatedAt: result.catalog.updatedAt,
        message:
          result.removedVideos.length > 0 || result.removedDrama
            ? `Removed “${result.removedDrama?.title || dramaId}” and ${result.removedVideos.length} episode${result.removedVideos.length === 1 ? "" : "s"} from the catalog.`
            : "Series was not in the uploads catalog.",
      });
    } catch (err) {
      return NextResponse.json(
        {
          error: "remove_series_failed",
          message: err instanceof Error ? err.message : "Remove failed",
        },
        { status: 500 },
      );
    }
  }

  if (body.rebuildFromBlobs) {
    try {
      const result = await rebuildUploadsCatalogFromBlobs();
      return NextResponse.json({
        ok: true,
        rebuilt: true,
        added: result.added,
        scanned: result.scanned,
        dramaCount: result.catalog.dramas.length,
        videoCount: result.catalog.videos.length,
        updatedAt: result.catalog.updatedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rebuild failed";
      return NextResponse.json(
        { error: "rebuild_failed", message },
        { status: 500 },
      );
    }
  }

  const dramas = Array.isArray(body.dramas) ? body.dramas : [];
  const videos = Array.isArray(body.videos) ? body.videos : [];
  if (dramas.length === 0 && videos.length === 0) {
    return NextResponse.json(
      { error: "empty", message: "Provide dramas and/or videos to save." },
      { status: 400 },
    );
  }

  try {
    // Read-merge-write twice so a stale Blob snapshot can't drop siblings
    // that landed between the first load and this save.
    let next = upsertUploadsCatalog(await loadUploadsCatalog(), {
      dramas,
      videos,
    });
    await saveUploadsCatalog(next);
    next = upsertUploadsCatalog(await loadUploadsCatalog(), {
      dramas,
      videos,
    });
    const saved = await saveUploadsCatalog(next);
    return NextResponse.json({
      ok: true,
      dramaCount: next.dramas.length,
      videoCount: next.videos.length,
      updatedAt: next.updatedAt,
      url: saved.url ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: "save_failed", message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;
  const catalog = await loadUploadsCatalog();
  return NextResponse.json(catalog);
}
