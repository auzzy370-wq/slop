import { NextResponse } from "next/server";
import { getBlobHealth } from "@/lib/admin/blob-health";
import { isR2Configured } from "@/lib/r2";
import { isSupabaseStorageConfigured } from "@/lib/supabase/storage";
import { loadUploadsCatalog } from "@/lib/uploads-catalog";

/** Public read of admin-uploaded dramas/episodes overlay. */
export async function GET() {
  try {
    const [catalog, blobHealth] = await Promise.all([
      loadUploadsCatalog(),
      process.env.BLOB_READ_WRITE_TOKEN
        ? getBlobHealth({ probeWrite: false })
        : Promise.resolve({
            configured: false,
            listOk: false,
            writeOk: false,
            readOk: false,
            suspended: false,
            message: "Blob not configured",
          }),
    ]);

    const blobSuspended = Boolean(
      blobHealth.suspended || (blobHealth.configured && !blobHealth.readOk),
    );
    const supabaseConfigured = isSupabaseStorageConfigured();
    const preferred = isR2Configured()
      ? "r2"
      : supabaseConfigured
        ? "supabase"
        : blobHealth.writeOk && !blobSuspended
          ? "blob"
          : "none";

    return NextResponse.json(
      {
        ...catalog,
        storage: {
          blobConfigured: blobHealth.configured,
          blobSuspended,
          blobReadable: Boolean(blobHealth.readOk),
          r2Configured: isR2Configured(),
          supabaseConfigured,
          preferred,
          message: blobSuspended
            ? "Vercel Blob is blocked — uploaded episodes can’t play until you unsuspend Blob or re-upload via the free-tier pool (R2 / Supabase)."
            : undefined,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json(
      { version: 1, updatedAt: null, dramas: [], videos: [], error: message },
      { status: 200 },
    );
  }
}
