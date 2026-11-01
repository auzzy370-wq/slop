import { getBlobHealth } from "@/lib/admin/blob-health";
import {
  migrateBlobToR2Batch,
  previewBlobToR2Migration,
  type MigrateBatchResult,
} from "@/lib/admin/migrate-blob-to-r2";
import { getR2Health } from "@/lib/r2";

export type AutoMigrateStatus = {
  armed: boolean;
  canRun: boolean;
  waitingOn: Array<"r2" | "blob_reads">;
  pending: number;
  pendingBytes: number;
  message: string;
  r2Ok: boolean;
  blobReadable: boolean;
  blobSuspended: boolean;
};

export async function getAutoMigrateStatus(): Promise<AutoMigrateStatus> {
  const [r2, blob, preview] = await Promise.all([
    getR2Health(),
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
    previewBlobToR2Migration(),
  ]);

  const waitingOn: Array<"r2" | "blob_reads"> = [];
  if (!r2.ok) waitingOn.push("r2");
  const blobReadable = Boolean(blob.readOk) && !blob.suspended;
  if (!blobReadable) waitingOn.push("blob_reads");

  const pending = preview.pending;
  const canRun = waitingOn.length === 0 && pending > 0;
  const armed = pending > 0 || waitingOn.includes("r2");

  let message = "No Blob episodes left to move.";
  if (!r2.ok && pending >= 0) {
    message =
      "Auto-migrate armed — add Cloudflare R2 env vars (R2_*), redeploy, then temporarily unsuspend Vercel Blob so files can be copied.";
  } else if (r2.ok && !blobReadable && pending > 0) {
    message = `Auto-migrate ready (${pending} episodes). Vercel Blob reads are still blocked — briefly unsuspend/reactivate the Blob store in Vercel; copying starts automatically.`;
  } else if (canRun) {
    message = `Auto-migrating ${pending} episode${pending === 1 ? "" : "s"} Blob → R2 now.`;
  } else if (r2.ok && pending === 0) {
    message = "All catalog episodes are already on R2 (or none were on Blob).";
  }

  return {
    armed,
    canRun,
    waitingOn,
    pending,
    pendingBytes: preview.pendingBytes,
    message,
    r2Ok: r2.ok,
    blobReadable,
    blobSuspended: Boolean(blob.suspended),
  };
}

/**
 * Run as many migrate batches as fit in the time budget.
 * Safe to call from cron / admin — no-ops when not ready.
 */
export async function runAutoMigrate(opts?: {
  maxBatches?: number;
  limitPerBatch?: number;
  timeBudgetMs?: number;
}): Promise<{
  status: AutoMigrateStatus;
  ran: boolean;
  batches: number;
  migrated: number;
  bytesCopied: number;
  remaining: number;
  readBlocked: boolean;
  results: MigrateBatchResult[];
  message: string;
}> {
  const status = await getAutoMigrateStatus();
  if (!status.canRun) {
    return {
      status,
      ran: false,
      batches: 0,
      migrated: 0,
      bytesCopied: 0,
      remaining: status.pending,
      readBlocked: status.waitingOn.includes("blob_reads"),
      results: [],
      message: status.message,
    };
  }

  const maxBatches = Math.max(1, Math.min(opts?.maxBatches ?? 8, 20));
  const limitPerBatch = Math.max(1, Math.min(opts?.limitPerBatch ?? 1, 3));
  const timeBudgetMs = opts?.timeBudgetMs ?? 45_000;
  const started = Date.now();

  const results: MigrateBatchResult[] = [];
  let migrated = 0;
  let bytesCopied = 0;
  let remaining = status.pending;
  let readBlocked = false;

  for (let i = 0; i < maxBatches; i++) {
    if (Date.now() - started > timeBudgetMs) break;
    const batch = await migrateBlobToR2Batch({
      limit: limitPerBatch,
      deleteFromBlob: false,
    });
    results.push(batch);
    migrated += batch.migrated;
    bytesCopied += batch.bytesCopied;
    remaining = batch.remaining;
    if (batch.readBlocked) {
      readBlocked = true;
      break;
    }
    if (batch.migrated === 0 && batch.failed === 0) break;
    if (remaining <= 0) break;
  }

  const refreshed = await getAutoMigrateStatus();
  return {
    status: refreshed,
    ran: migrated > 0 || results.length > 0,
    batches: results.length,
    migrated,
    bytesCopied,
    remaining,
    readBlocked,
    results,
    message:
      migrated > 0
        ? `Auto-migrated ${migrated} episode${migrated === 1 ? "" : "s"} to R2. ${remaining} remaining.`
        : readBlocked
          ? "Blob reads blocked mid-run — unsuspend Blob to continue; auto-migrate will resume."
          : refreshed.message,
  };
}
