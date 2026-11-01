"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Upload, X } from "lucide-react";
import {
  clearFinishedUploadBatch,
  isUploadRunning,
  subscribeUploadQueue,
  type UploadBatch,
} from "@/lib/admin-upload-queue";
import { toast } from "sonner";

/**
 * Global dock so mass uploads keep running after leaving /admin/videos.
 */
export function UploadProgressDock() {
  const [batch, setBatch] = useState<UploadBatch | null>(null);
  const toastedId = useRef<string | null>(null);

  useEffect(() => subscribeUploadQueue(setBatch), []);

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!isUploadRunning()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  useEffect(() => {
    if (!batch || batch.running || !batch.finishedAt) return;
    if (toastedId.current === batch.id) return;
    toastedId.current = batch.id;
    const done = batch.jobs.filter((j) => j.status === "done").length;
    const failed = batch.jobs.filter((j) => j.status === "error").length;
    if (failed === 0 && done > 0) {
      toast.success(
        `Background upload finished — ${done} episode${done === 1 ? "" : "s"} saved to “${batch.drama.title}”`,
      );
    } else if (done > 0) {
      toast.message(
        `Upload finished — ${done} saved, ${failed} failed for “${batch.drama.title}”`,
      );
    } else if (failed > 0) {
      toast.error(`Upload failed for “${batch.drama.title}”`);
    }
  }, [batch]);

  if (!batch) return null;

  const done = batch.jobs.filter((j) => j.status === "done").length;
  const failed = batch.jobs.filter((j) => j.status === "error").length;
  const total = batch.jobs.length;
  const current = batch.jobs.find((j) => j.status === "uploading");
  const pct = Math.round(((done + (current ? 0.35 : 0)) / Math.max(1, total)) * 100);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:bottom-4 lg:justify-end lg:pr-6">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/12 bg-[rgba(17,17,22,0.94)] p-3 shadow-[0_16px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="mb-2 flex items-start gap-2">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--slop-violet)]/20 text-[var(--slop-violet)]">
            {batch.running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : failed === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {batch.running ? "Uploading in background" : "Upload finished"}
            </p>
            <p className="truncate text-xs text-white/50">
              {batch.drama.title} · {done}/{total}
              {failed > 0 ? ` · ${failed} failed` : ""}
              {batch.running
                ? " · keep this tab open on phone"
                : ""}
            </p>
          </div>
          {!batch.running ? (
            <button
              type="button"
              className="rounded-lg p-1 text-white/40 hover:bg-white/5 hover:text-white"
              aria-label="Dismiss"
              onClick={() => clearFinishedUploadBatch()}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--slop-violet)] transition-all"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>

        {current ? (
          <p className="mb-2 truncate text-[11px] text-white/45">
            EP{String(current.episodeNumber).padStart(2, "0")} · {current.label}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2 text-xs">
          <Link
            href="/admin/videos"
            className="font-semibold text-[var(--slop-violet)] hover:underline"
          >
            Open Episodes
          </Link>
          {batch.running ? (
            <span className="text-white/35">
              Saved as each EP finishes — reopen + re-drop to resume
            </span>
          ) : (
            <button
              type="button"
              className="font-semibold text-white/55 hover:text-white"
              onClick={() => clearFinishedUploadBatch()}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
