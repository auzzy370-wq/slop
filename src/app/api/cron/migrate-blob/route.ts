import { NextResponse } from "next/server";
import { runAutoMigrate } from "@/lib/admin/auto-migrate";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function authorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") || "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;

  // Allow admin key for manual kick from dashboard / scripts.
  const adminKey = process.env.SLOP_ADMIN_KEY?.trim();
  const headerKey = request.headers.get("x-slop-admin-key")?.trim();
  if (adminKey && headerKey && headerKey === adminKey) return true;

  // Local / preview without secrets: only when neither is configured.
  if (!cronSecret && !adminKey && process.env.VERCEL !== "1") return true;
  return false;
}

/** Vercel Cron + manual kick: auto-copy Blob episodes → R2 when both are ready. */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAutoMigrate({
      maxBatches: 6,
      limitPerBatch: 1,
      timeBudgetMs: 50_000,
    });
    return NextResponse.json({
      ok: true,
      ...result,
      formattedBytesCopied: formatBytes(result.bytesCopied),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "auto_migrate_failed",
        message: err instanceof Error ? err.message : "Auto-migrate failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
