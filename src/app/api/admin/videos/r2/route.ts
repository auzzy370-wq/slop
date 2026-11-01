import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import {
  episodeObjectKey,
  getR2Health,
  isR2Configured,
  r2PresignPut,
} from "@/lib/r2";

/**
 * Cloudflare R2 mass-upload handshake.
 * Client asks for a presigned PUT URL, uploads the MP4 directly to R2,
 * then registers the returned publicUrl in the catalog.
 */
export async function GET(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;
  const health = await getR2Health();
  return NextResponse.json(health);
}

export async function POST(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;

  if (!isR2Configured()) {
    return NextResponse.json(
      {
        error: "r2_not_configured",
        message:
          "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL.",
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
  const contentType = body.contentType?.trim() || "video/mp4";

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
    const key = episodeObjectKey(dramaId, episodeNumber, filename);
    const signed = await r2PresignPut({
      key,
      contentType,
      expiresIn: 60 * 30,
    });
    return NextResponse.json({
      ok: true,
      ...signed,
      dramaId,
      episodeNumber: Math.floor(episodeNumber),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "R2 presign failed";
    return NextResponse.json(
      { error: "r2_presign_failed", message },
      { status: 500 },
    );
  }
}
