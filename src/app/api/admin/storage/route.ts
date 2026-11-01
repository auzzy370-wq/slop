import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import { getBlobHealth } from "@/lib/admin/blob-health";
import {
  getStorageReport,
  planOrphanPurge,
  purgeOrphanBlobs,
} from "@/lib/admin/blob-storage";
import { getAutoMigrateStatus } from "@/lib/admin/auto-migrate";
import { previewBlobToR2Migration } from "@/lib/admin/migrate-blob-to-r2";
import { getR2Health, isR2Configured, r2ListObjects } from "@/lib/r2";
import { getFreeStoragePool } from "@/lib/storage/free-pool";
import {
  getSupabaseStorageHealth,
  isSupabaseStorageConfigured,
  listSupabaseVideoUsage,
} from "@/lib/supabase/storage";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** GET — Blob + R2 storage usage report. */
export async function GET(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;

  try {
    const [
      report,
      health,
      r2Health,
      supabaseHealth,
      freePool,
      migratePreview,
      autoMigrate,
    ] = await Promise.all([
      getStorageReport(),
      getBlobHealth({ probeWrite: false }),
      getR2Health(),
      getSupabaseStorageHealth(),
      getFreeStoragePool(),
      previewBlobToR2Migration().catch(() => null),
      getAutoMigrateStatus().catch(() => null),
    ]);

    let r2 = {
      configured: isR2Configured(),
      objects: 0,
      videos: 0,
      bytes: 0,
      videoBytes: 0,
      dramas: [] as Array<{
        dramaId: string;
        files: number;
        uniqueEpisodes: number;
        bytes: number;
      }>,
    };
    if (r2Health.ok) {
      const objects = await r2ListObjects("slop/");
      const videos = objects.filter((o) => /\.(mp4|mov|webm)$/i.test(o.key));
      const byDrama = new Map<
        string,
        { files: number; eps: Set<number>; bytes: number }
      >();
      for (const v of videos) {
        const m = v.key.match(/^slop\/([^/]+)\/ep-0*(\d+)/i);
        const dramaId = m?.[1] || "(unknown)";
        const ep = m ? Number(m[2]) : null;
        const cur = byDrama.get(dramaId) || {
          files: 0,
          eps: new Set<number>(),
          bytes: 0,
        };
        cur.files += 1;
        cur.bytes += v.size;
        if (ep != null) cur.eps.add(ep);
        byDrama.set(dramaId, cur);
      }
      r2 = {
        configured: true,
        objects: objects.length,
        videos: videos.length,
        bytes: objects.reduce((s, o) => s + o.size, 0),
        videoBytes: videos.reduce((s, o) => s + o.size, 0),
        dramas: [...byDrama.entries()]
          .map(([dramaId, d]) => ({
            dramaId,
            files: d.files,
            uniqueEpisodes: d.eps.size,
            bytes: d.bytes,
          }))
          .sort((a, b) => b.bytes - a.bytes),
      };
    }

    let supabase = {
      configured: isSupabaseStorageConfigured(),
      objects: 0,
      videos: 0,
      bytes: 0,
      videoBytes: 0,
    };
    if (supabaseHealth.ok) {
      try {
        const usage = await listSupabaseVideoUsage();
        const videos = usage.files.filter((f) =>
          /\.(mp4|mov|webm)$/i.test(f.path),
        );
        supabase = {
          configured: true,
          objects: usage.objects,
          videos: videos.length,
          bytes: usage.bytes,
          videoBytes: videos.reduce((s, f) => s + f.size, 0),
        };
      } catch {
        supabase = {
          configured: true,
          objects: supabaseHealth.objects ?? 0,
          videos: 0,
          bytes: supabaseHealth.bytes ?? 0,
          videoBytes: 0,
        };
      }
    }

    const plan =
      report.reclaimableBytes > 0 && !health.suspended
        ? await planOrphanPurge()
        : [];
    return NextResponse.json({
      ok: true,
      health,
      r2Health,
      supabaseHealth,
      r2,
      supabase,
      freePool,
      preferred: freePool.preferred,
      order: freePool.order,
      dualMode: Boolean(
        freePool.providers.filter((p) => p.ok || p.configured).length > 1,
      ),
      migrate: migratePreview
        ? {
            pending: migratePreview.pending,
            pendingBytes: migratePreview.pendingBytes,
            alreadyOnR2: migratePreview.alreadyOnR2,
            totalBlobEpisodes: migratePreview.totalBlobEpisodes,
            message: migratePreview.message,
            formattedPendingBytes: formatBytes(migratePreview.pendingBytes),
          }
        : null,
      autoMigrate,
      report,
      purgePreview: {
        files: plan.length,
        bytes: plan.reduce((s, p) => s + p.size, 0),
        byReason: {
          orphan_drama: plan.filter((p) => p.reason === "orphan_drama").length,
          duplicate: plan.filter((p) => p.reason === "duplicate").length,
          tombstoned: plan.filter((p) => p.reason === "tombstoned").length,
        },
      },
      formatted: {
        total: formatBytes(report.totals.bytes),
        videos: formatBytes(report.totals.videoBytes),
        active: formatBytes(report.activeBytes),
        reclaimable: formatBytes(report.reclaimableBytes),
        orphans: formatBytes(report.orphans.bytes),
        duplicates: formatBytes(report.duplicates.bytes),
        r2Total: formatBytes(r2.bytes),
        r2Videos: formatBytes(r2.videoBytes),
        supabaseTotal: formatBytes(supabase.bytes),
        supabaseVideos: formatBytes(supabase.videoBytes),
        poolFree: formatBytes(freePool.totalFreeBytes),
        poolUsed: formatBytes(freePool.totalUsedBytes),
        poolLimit: formatBytes(freePool.totalLimitBytes),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage report failed";
    return NextResponse.json(
      { error: "storage_report_failed", message },
      { status: 500 },
    );
  }
}

/**
 * POST — Purge orphan / duplicate / tombstoned Blob video files.
 * Body: `{ action: "purge" }` (required) or `{ action: "preview" }` for dry run.
 */
export async function POST(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;

  let body: { action?: string } = {};
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    body = {};
  }

  const action = body.action?.trim() || "purge";

  try {
    if (action === "preview") {
      const plan = await planOrphanPurge();
      return NextResponse.json({
        ok: true,
        action: "preview",
        files: plan.length,
        bytes: plan.reduce((s, p) => s + p.size, 0),
        formattedBytes: formatBytes(plan.reduce((s, p) => s + p.size, 0)),
        items: plan.slice(0, 100),
      });
    }

    if (action !== "purge") {
      return NextResponse.json(
        { error: "invalid_action", message: 'Use action "purge" or "preview"' },
        { status: 400 },
      );
    }

    const result = await purgeOrphanBlobs();
    const report = await getStorageReport();
    return NextResponse.json({
      ok: true,
      action: "purge",
      deleted: result.deleted,
      deletedBytes: result.deletedBytes,
      formattedDeleted: formatBytes(result.deletedBytes),
      errors: result.errors,
      report,
      message:
        result.deleted > 0
          ? `Purged ${result.deleted} file${result.deleted === 1 ? "" : "s"} (${formatBytes(result.deletedBytes)}).`
          : "Nothing to purge — storage is clean.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Purge failed";
    return NextResponse.json(
      { error: "purge_failed", message },
      { status: 500 },
    );
  }
}
