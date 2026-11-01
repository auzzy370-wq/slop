import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import {
  createSupabaseSignedUpload,
  episodeSupabaseKey,
  getSupabaseStorageHealth,
  isSupabaseStorageConfigured,
} from "@/lib/supabase/storage";

/**
 * Supabase Storage mass-upload handshake (1 GB free-tier spillover).
 * Client asks for a signed upload URL, PUTs the MP4, then catalogs publicUrl.
 */
export async function GET(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;
  const health = await getSupabaseStorageHealth();
  return NextResponse.json(health);
}

export async function POST(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;

  if (!isSupabaseStorageConfigured()) {
    return NextResponse.json(
      {
        error: "supabase_not_configured",
        message:
          "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for free-tier spillover.",
      },
      { status: 400 },
    );
  }

  let body: {
    action?: string;
    dramaId?: string;
    episodeNumber?: number;
    filename?: string;
    contentType?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = body.action?.trim() || "presign";
  if (action !== "presign") {
    return NextResponse.json(
      { error: "invalid_action", message: 'Use action "presign"' },
      { status: 400 },
    );
  }

  const dramaId = body.dramaId?.trim();
  const episodeNumber = Number(body.episodeNumber);
  const filename = body.filename?.trim() || `ep-${episodeNumber}.mp4`;

  if (!dramaId || !Number.isFinite(episodeNumber) || episodeNumber < 1) {
    return NextResponse.json(
      {
        error: "invalid_meta",
        message: "dramaId and episodeNumber are required",
      },
      { status: 400 },
    );
  }

  if (!/\.(mp4|mov|m4v|webm)$/i.test(filename)) {
    return NextResponse.json(
      { error: "invalid_type", message: "Only video files are allowed" },
      { status: 400 },
    );
  }

  try {
    const key = episodeSupabaseKey(dramaId, episodeNumber, filename);
    const signed = await createSupabaseSignedUpload({ key, upsert: true });
    return NextResponse.json({
      ok: true,
      ...signed,
      dramaId,
      episodeNumber: Math.floor(episodeNumber),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Supabase signed upload failed";
    return NextResponse.json(
      { error: "supabase_presign_failed", message },
      { status: 500 },
    );
  }
}
