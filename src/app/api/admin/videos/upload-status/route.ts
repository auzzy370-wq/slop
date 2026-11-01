import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import { getBlobHealth } from "@/lib/admin/blob-health";
import { getR2Health, isR2Configured } from "@/lib/r2";

/** Quick probe so the admin UI can tell R2 / Blob + admin-key status before uploading. */
export async function GET(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) {
    return NextResponse.json(
      {
        ok: false,
        r2Configured: isR2Configured(),
        blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
        blobSuspended: false,
        preferred: isR2Configured() ? "r2" : "none",
        adminKeyRequired:
          Boolean(process.env.SLOP_ADMIN_KEY) || process.env.VERCEL === "1",
        error: "unauthorized",
        message:
          "Admin key missing or wrong. Paste SLOP_ADMIN_KEY into the Mass upload key field.",
      },
      { status: 401 },
    );
  }

  const [r2, blob] = await Promise.all([
    getR2Health(),
    process.env.BLOB_READ_WRITE_TOKEN
      ? getBlobHealth({ probeWrite: true })
      : Promise.resolve({
          configured: false,
          listOk: false,
          writeOk: false,
          readOk: false,
          suspended: false,
          message: "Blob not configured",
          objects: 0,
          bytes: 0,
        }),
  ]);

  const preferred = r2.ok ? "r2" : blob.writeOk && !blob.suspended ? "blob" : "none";
  const ok = preferred !== "none";

  let message = "No cloud storage ready.";
  if (preferred === "r2") {
    message = "Ready for Cloudflare R2 mass upload (free tier).";
  } else if (preferred === "blob") {
    message = "Ready for Vercel Blob mass upload.";
  } else if (r2.configured && !r2.ok) {
    message = r2.message;
  } else if (blob.suspended) {
    message =
      "Vercel Blob is suspended. Configure Cloudflare R2 (free) — see README — then retry.";
  } else if (!r2.configured && !blob.configured) {
    message =
      "Set Cloudflare R2 env vars (recommended, free) or BLOB_READ_WRITE_TOKEN.";
  }

  const blobObjects = "objects" in blob ? (blob.objects ?? 0) : 0;
  const blobBytes = "bytes" in blob ? (blob.bytes ?? 0) : 0;

  return NextResponse.json({
    ok,
    preferred,
    r2Configured: r2.configured,
    r2Ok: r2.ok,
    r2Message: r2.message,
    r2Objects: r2.objects,
    r2Bytes: r2.bytes,
    blobConfigured: blob.configured,
    blobSuspended: blob.suspended,
    writeOk: preferred === "r2" ? r2.ok : blob.writeOk,
    readOk: preferred === "r2" ? r2.ok : blob.readOk,
    listOk: preferred === "r2" ? r2.ok : blob.listOk,
    objects: preferred === "r2" ? r2.objects : blobObjects,
    bytes: preferred === "r2" ? r2.bytes : blobBytes,
    adminKeyRequired:
      Boolean(process.env.SLOP_ADMIN_KEY) || process.env.VERCEL === "1",
    message,
  });
}
