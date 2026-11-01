"use client";

import { useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  CheckCircle2,
  FileVideo,
  Loader2,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatEpisodeTitle,
  rankUploadFiles,
  type RankedUploadFile,
} from "@/lib/episodes/filename";
import type { Drama, PublicationStatus, Video } from "@/lib/types";
import { slugify, uid } from "@/lib/utils";
import { useSlopStore } from "@/store/slop-store";
import { toast } from "sonner";

type UploadRow = RankedUploadFile & {
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  url?: string;
};

function adminHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const key = window.localStorage.getItem("slop_admin_key");
  return key ? { "x-slop-admin-key": key } : {};
}

async function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const d = Number.isFinite(el.duration) ? Math.round(el.duration) : 15;
      URL.revokeObjectURL(url);
      resolve(Math.max(1, d));
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(15);
    };
    el.src = url;
  });
}

async function uploadLocal(
  file: File,
  dramaId: string,
  episodeNumber: number,
): Promise<string> {
  const body = new FormData();
  body.set("dramaId", dramaId);
  body.set("episodeNumber", String(episodeNumber));
  body.set("file", file, file.name);

  const res = await fetch("/api/admin/videos/upload", {
    method: "POST",
    headers: adminHeaders(),
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || "Local upload failed");
  }
  return data.url as string;
}

async function uploadBlob(
  file: File,
  dramaId: string,
  episodeNumber: number,
): Promise<string> {
  const ep = String(episodeNumber).padStart(2, "0");
  const pathname = `slop/${dramaId}/ep-${ep}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const blob = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/admin/videos/blob",
    headers: adminHeaders() as Record<string, string>,
  });
  return blob.url;
}

export function MassUpload({ dramas }: { dramas: Drama[] }) {
  const videos = useSlopStore((s) => s.videos);
  const upsertVideo = useSlopStore((s) => s.upsertVideo);
  const upsertDrama = useSlopStore((s) => s.upsertDrama);
  const inputRef = useRef<HTMLInputElement>(null);

  const [dramaId, setDramaId] = useState(dramas[0]?.id ?? "");
  const [status, setStatus] = useState<PublicationStatus>("published");
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [preferBlob, setPreferBlob] = useState(true);

  const drama = dramas.find((d) => d.id === dramaId);

  const summary = useMemo(() => {
    const parsed = rows.filter((r) => r.parsed).length;
    const orphan = rows.length - parsed;
    return { parsed, orphan };
  }, [rows]);

  const onPick = (list: FileList | null) => {
    if (!list?.length) return;
    const files = Array.from(list).filter((f) => {
      const n = f.name.toLowerCase();
      return (
        f.type.startsWith("video/") ||
        n.endsWith(".mp4") ||
        n.endsWith(".mov") ||
        n.endsWith(".m4v") ||
        n.endsWith(".webm")
      );
    });
    if (files.length === 0) {
      toast.error("No video files found — use MP4 / MOV");
      return;
    }
    const ranked = rankUploadFiles(files).map((r) => ({
      ...r,
      status: "queued" as const,
      progress: 0,
    }));
    setRows(ranked);
    toast.success(
      `Sorted ${ranked.length} file${ranked.length === 1 ? "" : "s"} by episode number`,
    );
  };

  const patchRow = (index: number, patch: Partial<UploadRow>) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const runUpload = async () => {
    if (!drama) {
      toast.error("Select a drama first");
      return;
    }
    if (rows.length === 0) {
      toast.error("Choose EP## MP4 files to upload");
      return;
    }

    setBusy(true);
    let ok = 0;
    let failed = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      patchRow(i, { status: "uploading", progress: 8, error: undefined });
      try {
        let url: string;
        if (preferBlob) {
          try {
            url = await uploadBlob(row.file, drama.id, row.episodeNumber);
          } catch (blobErr) {
            // Fall back to local disk when Blob isn't configured.
            const msg =
              blobErr instanceof Error ? blobErr.message : String(blobErr);
            if (/blob_not_configured|BLOB_READ_WRITE_TOKEN|not configured/i.test(msg)) {
              url = await uploadLocal(row.file, drama.id, row.episodeNumber);
            } else {
              // Retry local once for non-Vercel / misconfig cases
              try {
                url = await uploadLocal(row.file, drama.id, row.episodeNumber);
              } catch {
                throw blobErr;
              }
            }
          }
        } else {
          url = await uploadLocal(row.file, drama.id, row.episodeNumber);
        }

        patchRow(i, { progress: 70 });
        const durationSeconds = await readDuration(row.file);
        const title = formatEpisodeTitle(row.episodeNumber, row.file.name);
        const existing = videos.find(
          (v) =>
            v.dramaId === drama.id && v.episodeNumber === row.episodeNumber,
        );

        const video: Video = {
          id: existing?.id ?? uid("ep"),
          slug:
            existing?.slug ??
            slugify(`${drama.slug}-ep-${row.episodeNumber}`),
          dramaId: drama.id,
          episodeNumber: row.episodeNumber,
          title: existing?.title && existing.title !== title ? existing.title : title,
          description:
            existing?.description ||
            `${drama.title} · Episode ${row.episodeNumber}`,
          videoUrl: url,
          thumbnailUrl:
            existing?.thumbnailUrl ||
            drama.posterUrl ||
            "/thumbnails/unsent-ep1.jpg",
          durationSeconds,
          aspectRatio: "9:16",
          categoryIds: existing?.categoryIds?.length
            ? existing.categoryIds
            : drama.genreIds,
          tags: existing?.tags?.length ? existing.tags : drama.tags,
          status,
          featured: existing?.featured ?? false,
          pinned: existing?.pinned ?? false,
          sourceAttribution:
            existing?.sourceAttribution || drama.sourceAttribution || drama.title,
          licensingNotes: existing?.licensingNotes || "Admin mass upload",
          viewCount: existing?.viewCount ?? 0,
          likeCount: existing?.likeCount ?? 0,
          commentCount: existing?.commentCount ?? 0,
          saveCount: existing?.saveCount ?? 0,
          createdAt: existing?.createdAt ?? now,
          publishedAt:
            status === "published" ? (existing?.publishedAt ?? now) : null,
          scheduledAt: status === "scheduled" ? now : null,
          commentsDisabled: existing?.commentsDisabled ?? false,
          playback: "video",
        };

        upsertVideo(video);
        patchRow(i, { status: "done", progress: 100, url });
        ok += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        patchRow(i, { status: "error", progress: 0, error: message });
        failed += 1;
      }
    }

    // Bump series episode count to cover the highest uploaded ep.
    const maxEp = Math.max(
      drama.episodeCount,
      ...rows.map((r) => r.episodeNumber),
      ...videos
        .filter((v) => v.dramaId === drama.id)
        .map((v) => v.episodeNumber),
    );
    if (maxEp !== drama.episodeCount) {
      upsertDrama({ ...drama, episodeCount: maxEp });
    }

    setBusy(false);
    if (failed === 0) {
      toast.success(`Imported ${ok} episode${ok === 1 ? "" : "s"}`);
    } else {
      toast.error(`Imported ${ok}, failed ${failed}`);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--slop-violet)]/30 bg-[rgba(185,154,255,0.06)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Mass upload</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Drop a batch of MP4s named like <code className="text-[var(--slop-lavender)]">EP49</code>,{" "}
            <code className="text-[var(--slop-lavender)]">EP48</code>, … — SLOP
            auto-sorts them ascending and publishes into the selected drama.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
          Admin only
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/45">
            Drama
          </span>
          <select
            className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm"
            value={dramaId}
            onChange={(e) => setDramaId(e.target.value)}
            disabled={busy}
          >
            <option value="">Select drama</option>
            {dramas.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/45">
            Publish as
          </span>
          <select
            className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as PublicationStatus)}
            disabled={busy}
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-white/70">
        <input
          type="checkbox"
          checked={preferBlob}
          onChange={(e) => setPreferBlob(e.target.checked)}
          disabled={busy}
        />
        Prefer Vercel Blob when configured (needed for large files on Vercel)
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm"
        multiple
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPick(e.dataTransfer.files);
        }}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-black/25 px-4 py-10 text-center transition hover:border-[var(--slop-violet)]/50 hover:bg-black/35"
      >
        <Upload className="h-7 w-7 text-[var(--slop-violet)]" />
        <span className="font-semibold text-white">
          Drop EP## MP4s here or browse
        </span>
        <span className="text-xs text-white/45">
          Auto-sorts by episode number · replaces existing ep if same number
        </span>
      </button>

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/50">
            <p>
              {rows.length} files · {summary.parsed} matched EP##
              {summary.orphan > 0
                ? ` · ${summary.orphan} assigned sequentially`
                : ""}
            </p>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setRows([])}
            >
              Clear
            </Button>
          </div>

          <ul className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2">
            {rows.map((row, index) => (
              <li
                key={`${row.label}-${index}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm"
              >
                <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--slop-violet)]/20 font-mono text-xs font-bold text-[var(--slop-lavender)]">
                  {String(row.episodeNumber).padStart(2, "0")}
                </span>
                <FileVideo className="h-4 w-4 shrink-0 text-white/35" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white/90">
                    {row.label}
                  </p>
                  <p className="text-[11px] text-white/40">
                    {(row.file.size / (1024 * 1024)).toFixed(1)} MB
                    {!row.parsed ? " · no EP## in name" : ""}
                    {row.error ? ` · ${row.error}` : ""}
                  </p>
                  {row.status === "uploading" && (
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-[var(--slop-violet)] transition-all"
                        style={{ width: `${row.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                {row.status === "uploading" && (
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--slop-violet)]" />
                )}
                {row.status === "done" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                )}
                {row.status === "error" && (
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                )}
              </li>
            ))}
          </ul>

          <Button
            className="w-full sm:w-auto"
            disabled={busy || !dramaId}
            onClick={runUpload}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>Upload {rows.length} episodes</>
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
