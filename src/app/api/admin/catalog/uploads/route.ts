import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import type { Drama, Video } from "@/lib/types";
import {
  loadUploadsCatalog,
  saveUploadsCatalog,
  upsertUploadsCatalog,
} from "@/lib/uploads-catalog";

/**
 * Persist admin mass-upload metadata so episodes survive refresh / new devices.
 * MP4 bytes live in Blob (or /public/uploads); this stores the catalog overlay.
 */
export async function POST(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;

  let body: { dramas?: Drama[]; videos?: Video[] };
  try {
    body = (await request.json()) as { dramas?: Drama[]; videos?: Video[] };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
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
    const current = await loadUploadsCatalog();
    const next = upsertUploadsCatalog(current, { dramas, videos });
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
