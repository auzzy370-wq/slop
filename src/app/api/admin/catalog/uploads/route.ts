import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import type { Drama, Video } from "@/lib/types";
import {
  loadUploadsCatalog,
  rebuildUploadsCatalogFromBlobs,
  saveUploadsCatalog,
  upsertUploadsCatalog,
} from "@/lib/uploads-catalog";

/**
 * Persist admin mass-upload metadata so episodes survive refresh / new devices.
 * MP4 bytes live in Blob (or /public/uploads); this stores the catalog overlay.
 *
 * Body `{ rebuildFromBlobs: true }` rescans Blob MP4s and fills catalog gaps
 * (used when a mass upload lost episodes to stale catalog overwrites).
 */
export async function POST(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;

  let body: {
    dramas?: Drama[];
    videos?: Video[];
    rebuildFromBlobs?: boolean;
  };
  try {
    body = (await request.json()) as {
      dramas?: Drama[];
      videos?: Video[];
      rebuildFromBlobs?: boolean;
    };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
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
