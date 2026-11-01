import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";

/** Quick probe so the admin UI can tell Blob + admin-key status before uploading. */
export async function GET(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) {
    return NextResponse.json(
      {
        ok: false,
        blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
        adminKeyRequired: Boolean(process.env.SLOP_ADMIN_KEY) || process.env.VERCEL === "1",
        error: "unauthorized",
        message:
          "Admin key missing or wrong. Paste SLOP_ADMIN_KEY into the Mass upload key field.",
      },
      { status: 401 },
    );
  }

  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  return NextResponse.json({
    ok: true,
    blobConfigured,
    adminKeyRequired: Boolean(process.env.SLOP_ADMIN_KEY) || process.env.VERCEL === "1",
    message: blobConfigured
      ? "Ready for cloud mass upload"
      : "Blob not configured — set BLOB_READ_WRITE_TOKEN",
  });
}
