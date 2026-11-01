import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";

/**
 * Client-side Vercel Blob upload handshake for admin mass import.
 * Requires BLOB_READ_WRITE_TOKEN in the environment.
 */
export async function POST(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error: "blob_not_configured",
        message:
          "Set BLOB_READ_WRITE_TOKEN in the environment to enable cloud mass uploads.",
      },
      { status: 400 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.toLowerCase().match(/\.(mp4|mov|m4v|webm)$/)) {
          throw new Error("Only video files are allowed");
        }
        return {
          allowedContentTypes: [
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "video/x-m4v",
            "application/octet-stream",
          ],
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ source: "admin-mass-upload" }),
        };
      },
      onUploadCompleted: async () => {
        /* Client registers the episode in the local store after upload. */
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
