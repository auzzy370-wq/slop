import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import {
  getAutoMigrateStatus,
  runAutoMigrate,
} from "@/lib/admin/auto-migrate";
import {
  migrateBlobToR2Batch,
  previewBlobToR2Migration,
} from "@/lib/admin/migrate-blob-to-r2";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** GET — preview how many Blob episodes can move to R2 without reupload. */
export async function GET(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;

  try {
    const [preview, auto] = await Promise.all([
      previewBlobToR2Migration(),
      getAutoMigrateStatus(),
    ]);
    return NextResponse.json({
      ...preview,
      auto,
      formattedPendingBytes: formatBytes(preview.pendingBytes),
      candidates: preview.candidates.slice(0, 100),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "migrate_preview_failed",
        message: err instanceof Error ? err.message : "Preview failed",
      },
      { status: 500 },
    );
  }
}

/**
 * POST — copy Blob episodes → Cloudflare R2 and rewrite catalog URLs.
 * Body:
 * - `{ mode: "auto" }` — run until budget / blocked / done (no click needed)
 * - `{ limit?, deleteFromBlob? }` — single batch
 */
export async function POST(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;

  let body: {
    mode?: string;
    limit?: number;
    deleteFromBlob?: boolean;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    if (body.mode === "auto") {
      const result = await runAutoMigrate({
        maxBatches: 8,
        limitPerBatch: 1,
        timeBudgetMs: 50_000,
      });
      return NextResponse.json({
        ok: true,
        mode: "auto",
        ...result,
        formattedBytesCopied: formatBytes(result.bytesCopied),
      });
    }

    const result = await migrateBlobToR2Batch({
      limit: body.limit,
      deleteFromBlob: body.deleteFromBlob,
    });
    const status = result.ok ? 200 : result.readBlocked ? 409 : 500;
    return NextResponse.json(
      {
        ...result,
        formattedBytesCopied: formatBytes(result.bytesCopied),
      },
      { status },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "migrate_failed",
        message: err instanceof Error ? err.message : "Migration failed",
      },
      { status: 500 },
    );
  }
}
