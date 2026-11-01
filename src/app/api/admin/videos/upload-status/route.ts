import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import { getBlobHealth } from "@/lib/admin/blob-health";

/** Quick probe so the admin UI can tell Blob + admin-key status before uploading. */
export async function GET(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) {
    return NextResponse.json(
      {
        ok: false,
        blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
        blobSuspended: false,
        adminKeyRequired:
          Boolean(process.env.SLOP_ADMIN_KEY) || process.env.VERCEL === "1",
        error: "unauthorized",
        message:
          "Admin key missing or wrong. Paste SLOP_ADMIN_KEY into the Mass upload key field.",
      },
      { status: 401 },
    );
  }

  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  if (!blobConfigured) {
    return NextResponse.json({
      ok: true,
      blobConfigured: false,
      blobSuspended: false,
      writeOk: false,
      readOk: false,
      adminKeyRequired:
        Boolean(process.env.SLOP_ADMIN_KEY) || process.env.VERCEL === "1",
      message: "Blob not configured — set BLOB_READ_WRITE_TOKEN",
    });
  }

  const health = await getBlobHealth();
  return NextResponse.json({
    ok: health.writeOk && !health.suspended,
    blobConfigured: true,
    blobSuspended: health.suspended,
    writeOk: health.writeOk,
    readOk: health.readOk,
    listOk: health.listOk,
    objects: health.objects,
    bytes: health.bytes,
    adminKeyRequired:
      Boolean(process.env.SLOP_ADMIN_KEY) || process.env.VERCEL === "1",
    message: health.suspended
      ? health.message
      : health.writeOk
        ? "Ready for cloud mass upload"
        : health.message,
  });
}
