import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import { getBlobHealth } from "@/lib/admin/blob-health";
import {
  getStorageReport,
  planOrphanPurge,
  purgeOrphanBlobs,
} from "@/lib/admin/blob-storage";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** GET — Blob storage usage report (totals, per-drama, orphans, reclaimable). */
export async function GET(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;

  try {
    const [report, health] = await Promise.all([
      getStorageReport(),
      getBlobHealth({ probeWrite: false }),
    ]);
    const plan =
      report.reclaimableBytes > 0 && !health.suspended
        ? await planOrphanPurge()
        : [];
    return NextResponse.json({
      ok: true,
      health,
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
