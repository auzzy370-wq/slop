import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import { isR2Configured } from "@/lib/r2";
import { isSupabaseStorageConfigured } from "@/lib/supabase/storage";
import { getFreeStoragePool } from "@/lib/storage/free-pool";

/** Quick probe so the admin UI can tell free-tier pool + admin-key status. */
export async function GET(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) {
    return NextResponse.json(
      {
        ok: false,
        r2Configured: isR2Configured(),
        supabaseConfigured: isSupabaseStorageConfigured(),
        blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
        blobSuspended: false,
        preferred: isR2Configured()
          ? "r2"
          : isSupabaseStorageConfigured()
            ? "supabase"
            : "none",
        order: [] as string[],
        adminKeyRequired:
          Boolean(process.env.SLOP_ADMIN_KEY) || process.env.VERCEL === "1",
        error: "unauthorized",
        message:
          "Admin key missing or wrong. Paste SLOP_ADMIN_KEY into the Mass upload key field.",
      },
      { status: 401 },
    );
  }

  const pool = await getFreeStoragePool();
  const preferred = pool.preferred;
  const ok = preferred !== "none";
  const r2 = pool.providers.find((p) => p.id === "r2")!;
  const supabase = pool.providers.find((p) => p.id === "supabase")!;
  const blob = pool.providers.find((p) => p.id === "blob")!;

  return NextResponse.json({
    ok,
    preferred,
    order: pool.order,
    pool: {
      totalFreeBytes: pool.totalFreeBytes,
      totalUsedBytes: pool.totalUsedBytes,
      totalLimitBytes: pool.totalLimitBytes,
      providers: pool.providers,
    },
    r2Configured: r2.configured,
    r2Ok: r2.ok,
    r2Message: r2.message,
    r2Objects: r2.objects,
    r2Bytes: r2.bytes,
    supabaseConfigured: supabase.configured,
    supabaseOk: supabase.ok,
    supabaseMessage: supabase.message,
    supabaseObjects: supabase.objects,
    supabaseBytes: supabase.bytes,
    blobConfigured: blob.configured,
    blobSuspended: Boolean(blob.suspended),
    writeOk: ok,
    readOk: ok,
    listOk: ok,
    objects:
      preferred === "r2"
        ? r2.objects
        : preferred === "supabase"
          ? supabase.objects
          : blob.objects,
    bytes:
      preferred === "r2"
        ? r2.bytes
        : preferred === "supabase"
          ? supabase.bytes
          : blob.bytes,
    adminKeyRequired:
      Boolean(process.env.SLOP_ADMIN_KEY) || process.env.VERCEL === "1",
    message: pool.message,
  });
}
