import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import { getBlobHealth } from "@/lib/admin/blob-health";
import {
  getStorageReport,
  planOrphanPurge,
  purgeOrphanBlobs,
} from "@/lib/admin/blob-storage";
import { previewBlobToR2Migration } from "@/lib/admin/migrate-blob-to-r2";
import { getR2Health, isR2Configured, r2ListObjects } from "@/lib/r2";

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
    const [report, health, r2Health, migratePreview] = await Promise.all([
      getStorageReport(),
      getBlobHealth({ probeWrite: false }),
      getR2Health(),
      previewBlobToR2Migration().catch(() => null),
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

    const plan =
      report.reclaimableBytes > 0 && !health.suspended
        ? await planOrphanPurge()
        : [];
    return NextResponse.json({
      ok: true,
      health,
      r2Health,
      r2,
      preferred: r2Health.ok ? "r2" : health.writeOk ? "blob" : "none",
      dualMode: Boolean(r2Health.ok && health.configured),
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
