"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MassUpload } from "@/components/admin/mass-upload";
import {
  ColumnChart,
  SimpleBars,
  StackedShareBar,
} from "@/components/admin/date-range-filter";
import { useSlopStore } from "@/store/slop-store";
import type { PublicationStatus, Video } from "@/lib/types";
import { triggerEpisodeAutoPost } from "@/lib/social/client";
import { formatBytes, slugify, uid } from "@/lib/utils";
import { toast } from "sonner";

const emptyForm = {
  title: "",
  description: "",
  videoUrl: "",
  thumbnailUrl: "",
  tags: "",
  dramaId: "",
  episodeNumber: 1,
  categoryIds: [] as string[],
  status: "draft" as PublicationStatus,
  featured: false,
  sourceAttribution: "SLOP Original",
  licensingNotes: "",
  autoPostSocial: true,
};

type StorageReportPayload = {
  ok?: boolean;
  preferred?: "r2" | "blob" | "none";
  dualMode?: boolean;
  migrate?: {
    pending: number;
    pendingBytes: number;
    alreadyOnR2: number;
    totalBlobEpisodes: number;
    message: string;
    formattedPendingBytes?: string;
  } | null;
  autoMigrate?: {
    armed: boolean;
    canRun: boolean;
    waitingOn: Array<"r2" | "blob_reads">;
    pending: number;
    pendingBytes: number;
    message: string;
    r2Ok: boolean;
    blobReadable: boolean;
    blobSuspended: boolean;
  } | null;
  health?: {
    configured: boolean;
    listOk: boolean;
    writeOk: boolean;
    readOk: boolean;
    suspended: boolean;
    message: string;
  };
  r2Health?: {
    configured: boolean;
    ok: boolean;
    message: string;
    objects?: number;
    bytes?: number;
  };
  r2?: {
    configured: boolean;
    objects: number;
    videos: number;
    bytes: number;
    videoBytes: number;
    dramas: Array<{
      dramaId: string;
      files: number;
      uniqueEpisodes: number;
      bytes: number;
    }>;
  };
  report?: {
    configured: boolean;
    totals: {
      objects: number;
      videos: number;
      bytes: number;
      videoBytes: number;
    };
    catalog: { dramas: number; videos: number };
    dramas: Array<{
      dramaId: string;
      title: string;
      files: number;
      uniqueEpisodes: number;
      bytes: number;
      inCatalogEpisodes: number;
    }>;
    orphans: { files: number; bytes: number };
    duplicates: { files: number; bytes: number };
    reclaimableBytes: number;
    activeBytes: number;
  };
  purgePreview?: {
    files: number;
    bytes: number;
    byReason: {
      orphan_drama: number;
      duplicate: number;
      tombstoned: number;
    };
  };
  formatted?: {
    total: string;
    videos: string;
    active: string;
    reclaimable: string;
    orphans: string;
    duplicates: string;
    r2Total?: string;
    r2Videos?: string;
  };
  error?: string;
  message?: string;
};

function adminHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (typeof window !== "undefined") {
    const adminKey = window.localStorage.getItem("slop_admin_key");
    if (adminKey) headers["x-slop-admin-key"] = adminKey;
  }
  return headers;
}

export default function VideosClient() {
  const videos = useSlopStore((s) => s.videos);
  const dramas = useSlopStore((s) => s.dramas);
  const categories = useSlopStore((s) => s.categories);
  const upsertVideo = useSlopStore((s) => s.upsertVideo);
  const deleteVideo = useSlopStore((s) => s.deleteVideo);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [storage, setStorage] = useState<StorageReportPayload | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [migrateBusy, setMigrateBusy] = useState(false);
  const [migrateLog, setMigrateLog] = useState("");
  const autoMigrateStarted = useRef(false);

  const sortedVideos = useMemo(
    () =>
      [...videos].sort((a, b) => {
        if (a.dramaId !== b.dramaId) return a.dramaId.localeCompare(b.dramaId);
        return a.episodeNumber - b.episodeNumber;
      }),
    [videos],
  );

  const allSelected =
    sortedVideos.length > 0 && selected.size === sortedVideos.length;
  const someSelected = selected.size > 0 && !allSelected;

  const loadStorage = useCallback(async () => {
    setStorageLoading(true);
    try {
      const res = await fetch("/api/admin/storage", {
        headers: adminHeaders(),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as StorageReportPayload;
      if (!res.ok) {
        setStorage({
          ok: false,
          error: data.error,
          message: data.message || "Could not load storage report",
        });
        return;
      }
      setStorage(data);
    } catch {
      setStorage({
        ok: false,
        message: "Storage request failed",
      });
    } finally {
      setStorageLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStorage();
  }, [loadStorage]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sortedVideos.map((v) => v.id)));
    }
  };

  const deleteEpisodes = async (targets: Video[]) => {
    if (!targets.length) return;
    const toastId = toast.loading(
      targets.length === 1
        ? "Deleting episode…"
        : `Deleting ${targets.length} episodes…`,
    );
    try {
      const res = await fetch("/api/admin/videos/delete", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(
          targets.length === 1
            ? {
                videoId: targets[0]!.id,
                videoUrl: targets[0]!.videoUrl,
                dramaId: targets[0]!.dramaId,
                episodeNumber: targets[0]!.episodeNumber,
              }
            : {
                videos: targets.map((v) => ({
                  videoId: v.id,
                  videoUrl: v.videoUrl,
                  dramaId: v.dramaId,
                  episodeNumber: v.episodeNumber,
                })),
              },
        ),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        storageFreed?: boolean;
        filesRemoved?: number;
        mediaErrors?: string[];
        deletedIds?: string[];
      };
      if (!res.ok || !data.ok) {
        toast.error(
          data.message || data.error || "Could not delete episode(s)",
          { id: toastId },
        );
        return;
      }
      for (const v of targets) deleteVideo(v.id);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const v of targets) next.delete(v.id);
        return next;
      });
      if (data.storageFreed) {
        toast.success(
          data.message ||
            `Deleted and removed ${data.filesRemoved ?? 1} file(s) from storage`,
          { id: toastId },
        );
      } else if (data.mediaErrors?.length) {
        toast.message(
          data.message || "Removed from catalog; some files may remain",
          {
            id: toastId,
            description: data.mediaErrors[0],
          },
        );
      } else {
        toast.success(data.message || "Episode(s) deleted", { id: toastId });
      }
      void loadStorage();
    } catch {
      toast.error("Delete request failed", { id: toastId });
    }
  };

  const bulkDelete = async () => {
    const targets = sortedVideos.filter((v) => selected.has(v.id));
    if (!targets.length) return;
    const confirmed = window.confirm(
      `Delete ${targets.length} episode${targets.length === 1 ? "" : "s"} and free their video storage? This cannot be undone.`,
    );
    if (!confirmed) return;
    setBulkBusy(true);
    try {
      await deleteEpisodes(targets);
    } finally {
      setBulkBusy(false);
    }
  };

  const migrateBlobToR2 = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
      if (migrateBusy) return;
      if (!storage?.r2Health?.ok && !silent) {
        toast.error(
          "Configure Cloudflare R2 (R2_* env vars) and redeploy before migrating.",
        );
        return;
      }
      if (!silent) {
        const pending = storage?.migrate?.pending ?? 0;
        const confirmed = window.confirm(
          pending > 0
            ? `Copy ${pending} existing Blob episode${pending === 1 ? "" : "s"} to Cloudflare R2 without reuploading? Catalog URLs update automatically. Original Blob files are kept (dual storage).`
            : "Run Blob → R2 migration check? Existing catalog episodes on Blob will be copied if any remain.",
        );
        if (!confirmed) return;
      }

      setMigrateBusy(true);
      if (!silent) setMigrateLog("");
      const toastId = silent
        ? null
        : toast.loading("Migrating Blob → R2 (no reupload)…");
      let totalMigrated = 0;
      let totalBytes = 0;
      let rounds = 0;

      try {
        for (;;) {
          rounds += 1;
          const res = await fetch("/api/admin/storage/migrate", {
            method: "POST",
            headers: adminHeaders(),
            body: JSON.stringify({ mode: "auto" }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            migrated?: number;
            remaining?: number;
            bytesCopied?: number;
            failed?: number;
            readBlocked?: boolean;
            canRun?: boolean;
            message?: string;
            error?: string;
            status?: { canRun?: boolean; waitingOn?: string[] };
          };

          const migrated = data.migrated || 0;
          totalMigrated += migrated;
          totalBytes += data.bytesCopied || 0;
          setMigrateLog(
            `Auto round ${rounds}: +${migrated} · total ${totalMigrated} · remaining ${data.remaining ?? "?"}`,
          );

          if (data.readBlocked || data.status?.waitingOn?.includes("blob_reads")) {
            if (toastId) {
              toast.message(data.message || "Waiting for Blob reads…", {
                id: toastId,
                description:
                  "Auto-migrate will resume when the Blob store is unsuspended.",
              });
            }
            break;
          }

          if (!res.ok && migrated === 0 && !silent) {
            toast.error(data.message || data.error || "Migration failed", {
              id: toastId ?? undefined,
            });
            break;
          }

          if (!data.remaining || data.remaining <= 0 || migrated === 0) {
            if (toastId) {
              toast.success(
                totalMigrated > 0
                  ? `Migrated ${totalMigrated} episode${totalMigrated === 1 ? "" : "s"} to R2 (${formatBytes(totalBytes)}).`
                  : data.message || "Nothing left to migrate.",
                { id: toastId },
              );
            } else if (totalMigrated > 0) {
              toast.success(
                `Auto-moved ${totalMigrated} episode${totalMigrated === 1 ? "" : "s"} to R2`,
              );
            }
            break;
          }

          if (toastId) {
            toast.loading(
              `Migrating… ${totalMigrated} done, ${data.remaining} left`,
              { id: toastId },
            );
          }
        }
        await loadStorage();
      } catch {
        if (toastId) toast.error("Migration request failed", { id: toastId });
      } finally {
        setMigrateBusy(false);
      }
    },
    [migrateBusy, storage?.r2Health?.ok, storage?.migrate?.pending, loadStorage],
  );

  // Auto-move whenever R2 is ready and Blob becomes readable — no button click.
  useEffect(() => {
    const auto = storage?.autoMigrate;
    if (!auto?.canRun || migrateBusy) return;
    if (autoMigrateStarted.current) return;
    autoMigrateStarted.current = true;
    void migrateBlobToR2({ silent: true }).finally(() => {
      // Allow another pass later if more files appear / Blob unblocks again.
      window.setTimeout(() => {
        autoMigrateStarted.current = false;
      }, 60_000);
    });
  }, [storage?.autoMigrate, migrateBusy, migrateBlobToR2]);

  // Keep polling while armed but waiting (R2 missing or Blob blocked).
  useEffect(() => {
    const auto = storage?.autoMigrate;
    if (!auto?.armed || auto.canRun) return;
    const id = window.setInterval(() => {
      void loadStorage();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [storage?.autoMigrate, loadStorage]);

  const purgeOrphans = async () => {
    const preview = storage?.purgePreview;
    const reclaimable =
      storage?.formatted?.reclaimable ||
      formatBytes(storage?.report?.reclaimableBytes ?? 0);
    const confirmed = window.confirm(
      preview && preview.files > 0
        ? `Purge ${preview.files} orphan/duplicate file${preview.files === 1 ? "" : "s"} (${reclaimable})? Active catalog episodes are kept.`
        : "Purge orphan and duplicate Blob files? Active catalog episodes are kept.",
    );
    if (!confirmed) return;
    setPurgeBusy(true);
    const toastId = toast.loading("Purging orphan Blob files…");
    try {
      const res = await fetch("/api/admin/storage", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ action: "purge" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        deleted?: number;
        formattedDeleted?: string;
        errors?: string[];
      };
      if (!res.ok || !data.ok) {
        toast.error(data.message || data.error || "Purge failed", {
          id: toastId,
        });
        return;
      }
      toast.success(data.message || "Purge complete", {
        id: toastId,
        description: data.errors?.length
          ? `${data.errors.length} file(s) failed`
          : undefined,
      });
      await loadStorage();
    } catch {
      toast.error("Purge request failed", { id: toastId });
    } finally {
      setPurgeBusy(false);
    }
  };

  const save = async () => {
    if (!form.title.trim() || !form.videoUrl.trim() || !form.dramaId) {
      toast.error("Title, drama, and video URL are required");
      return;
    }
    const now = new Date().toISOString();
    const existing = editingId
      ? videos.find((v) => v.id === editingId)
      : null;
    const drama = dramas.find((d) => d.id === form.dramaId);
    const wasPublished = existing?.status === "published";
    const video: Video = {
      id: existing?.id ?? uid("ep"),
      slug: existing?.slug ?? slugify(`${drama?.slug ?? "drama"}-ep-${form.episodeNumber}`),
      dramaId: form.dramaId,
      episodeNumber: Number(form.episodeNumber) || 1,
      title: form.title.trim(),
      description: form.description.trim(),
      videoUrl: form.videoUrl.trim(),
      thumbnailUrl: form.thumbnailUrl.trim() || "/thumbnails/unsent-ep1.jpg",
      durationSeconds: existing?.durationSeconds ?? 15,
      aspectRatio: "9:16",
      categoryIds:
        form.categoryIds.length > 0
          ? form.categoryIds
          : drama?.genreIds ?? [],
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      status: form.status,
      featured: form.featured,
      pinned: existing?.pinned ?? false,
      sourceAttribution: form.sourceAttribution || drama?.title || "SLOP Original",
      licensingNotes: form.licensingNotes,
      viewCount: existing?.viewCount ?? 0,
      likeCount: existing?.likeCount ?? 0,
      commentCount: existing?.commentCount ?? 0,
      saveCount: existing?.saveCount ?? 0,
      createdAt: existing?.createdAt ?? now,
      publishedAt:
        form.status === "published" ? (existing?.publishedAt ?? now) : null,
      scheduledAt: form.status === "scheduled" ? now : null,
      commentsDisabled: existing?.commentsDisabled ?? false,
    };
    upsertVideo(video);
    toast.success(editingId ? "Episode updated" : "Episode saved");

    const shouldAutoPost =
      form.autoPostSocial &&
      form.status === "published" &&
      !wasPublished &&
      video.episodeNumber <= 2 &&
      drama;

    if (shouldAutoPost && drama) {
      const toastId = toast.loading(
        `Auto-posting Ep ${video.episodeNumber} to socials…`,
      );
      try {
        const result = await triggerEpisodeAutoPost({
          dramaId: drama.id,
          dramaTitle: drama.title,
          dramaSlug: drama.slug,
          episodeId: video.id,
          episodeNumber: video.episodeNumber,
          episodeTitle: video.title,
          episodeSlug: video.slug,
          description: video.description,
          thumbnailUrl: video.thumbnailUrl,
          videoUrl: video.videoUrl,
        });
        if (result.skipped) {
          toast.message(result.message || "Auto-post skipped", { id: toastId });
        } else if (result.ok) {
          toast.success(result.message || "Posted to socials", { id: toastId });
        } else {
          toast.error(result.message || "Social auto-post failed", {
            id: toastId,
          });
        }
      } catch {
        toast.error("Social auto-post request failed", { id: toastId });
      }
    }

    setForm(emptyForm);
    setEditingId(null);
  };

  const edit = (video: Video) => {
    setEditingId(video.id);
    setForm({
      title: video.title,
      description: video.description,
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnailUrl,
      tags: video.tags.join(", "),
      dramaId: video.dramaId,
      episodeNumber: video.episodeNumber,
      categoryIds: video.categoryIds,
      status: video.status,
      featured: video.featured,
      sourceAttribution: video.sourceAttribution,
      licensingNotes: video.licensingNotes,
      autoPostSocial: true,
    });
  };

  const report = storage?.report;
  const reclaimable = report?.reclaimableBytes ?? 0;
  const r2 = storage?.r2;
  const preferred = storage?.preferred ?? "none";
  const dramaTitle = (dramaId: string) =>
    dramas.find((d) => d.id === dramaId)?.title || dramaId;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Episode management</h1>
        <p className="mt-1 text-sm text-white/50">
          Only admins publish episodes. Users cannot upload or generate videos.
          Mass-upload MP4s named <span className="text-white/70">EP01</span>,{" "}
          <span className="text-white/70">EP02</span>, … and they auto-sort.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Cloud storage</h2>
            <p className="mt-0.5 text-xs text-white/45">
              Cloudflare R2 is preferred (free tier). Vercel Blob remains a
              fallback — orphans there can still be purged.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={storageLoading}
              onClick={() => void loadStorage()}
            >
              {storageLoading ? "Refreshing…" : "Refresh"}
            </Button>
            <Button
              size="sm"
              disabled={
                migrateBusy ||
                storageLoading ||
                !storage?.r2Health?.ok ||
                (storage?.migrate?.pending ?? 0) <= 0
              }
              onClick={() => void migrateBlobToR2()}
            >
              {migrateBusy
                ? "Migrating…"
                : (storage?.migrate?.pending ?? 0) > 0
                  ? `Migrate ${storage?.migrate?.pending} to R2 (no reupload)`
                  : "Migrate Blob → R2"}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={
                purgeBusy ||
                storageLoading ||
                !report?.configured ||
                reclaimable <= 0 ||
                Boolean(storage?.health?.suspended)
              }
              onClick={() => void purgeOrphans()}
            >
              {purgeBusy
                ? "Purging…"
                : reclaimable > 0
                  ? `Purge Blob orphans (${storage?.formatted?.reclaimable ?? formatBytes(reclaimable)})`
                  : "Nothing to purge"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-1 ${
              preferred === "r2"
                ? "bg-emerald-400/15 text-emerald-200"
                : preferred === "blob"
                  ? "bg-[var(--slop-violet)]/20 text-[var(--slop-lavender)]"
                  : "bg-white/10 text-white/55"
            }`}
          >
            Preferred:{" "}
            {preferred === "r2"
              ? "Cloudflare R2"
              : preferred === "blob"
                ? "Vercel Blob"
                : "none configured"}
          </span>
        </div>

        {storage?.r2Health && (
          <div
            className={`rounded-xl border px-3 py-3 text-sm ${
              storage.r2Health.ok
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-50"
                : storage.r2Health.configured
                  ? "border-red-400/30 bg-red-400/10 text-red-50"
                  : "border-white/15 bg-white/[0.04] text-white/80"
            }`}
          >
            <p className="font-semibold">
              Cloudflare R2{" "}
              {storage.r2Health.ok
                ? "ready"
                : storage.r2Health.configured
                  ? "misconfigured"
                  : "not configured"}
            </p>
            <p className="mt-1 text-xs opacity-80">{storage.r2Health.message}</p>
            {r2 && r2.configured && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wide opacity-60">
                    R2 total
                  </p>
                  <p className="mt-1 font-display text-lg font-bold">
                    {storage.formatted?.r2Total ?? formatBytes(r2.bytes)}
                  </p>
                  <p className="text-xs opacity-60">{r2.objects} objects</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide opacity-60">
                    R2 videos
                  </p>
                  <p className="mt-1 font-display text-lg font-bold">
                    {storage.formatted?.r2Videos ?? formatBytes(r2.videoBytes)}
                  </p>
                  <p className="text-xs opacity-60">{r2.videos} files</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide opacity-60">
                    Series
                  </p>
                  <p className="mt-1 font-display text-lg font-bold">
                    {r2.dramas.length}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide opacity-60">
                    Unique eps
                  </p>
                  <p className="mt-1 font-display text-lg font-bold">
                    {r2.dramas.reduce((s, d) => s + d.uniqueEpisodes, 0)}
                  </p>
                </div>
              </div>
            )}
            {r2 && r2.dramas.length > 0 && (
              <div className="mt-4 space-y-3">
                <h3 className="text-sm font-semibold opacity-90">
                  R2 size by series
                </h3>
                <SimpleBars
                  labelWidth={120}
                  formatValue={formatBytes}
                  data={r2.dramas.slice(0, 10).map((d, i) => ({
                    label: dramaTitle(d.dramaId),
                    value: d.bytes,
                    color:
                      i === 0
                        ? "var(--slop-violet)"
                        : "rgba(185, 154, 255, 0.55)",
                  }))}
                />
              </div>
            )}
            {!storage.r2Health.configured && (
              <p className="mt-2 text-xs opacity-75">
                Set <code className="text-white/80">R2_ACCOUNT_ID</code>,{" "}
                <code className="text-white/80">R2_ACCESS_KEY_ID</code>,{" "}
                <code className="text-white/80">R2_SECRET_ACCESS_KEY</code>,{" "}
                <code className="text-white/80">R2_BUCKET_NAME</code>, and{" "}
                <code className="text-white/80">R2_PUBLIC_BASE_URL</code> in
                Vercel, then redeploy.
              </p>
            )}
            {storage.autoMigrate && (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs opacity-95">
                <p className="font-semibold">
                  {storage.autoMigrate.canRun
                    ? migrateBusy
                      ? "Auto-moving videos now…"
                      : "Auto-migrate ready"
                    : storage.autoMigrate.armed
                      ? "Auto-migrate armed — waiting"
                      : "Auto-migrate idle"}
                </p>
                <p className="mt-1 opacity-80">{storage.autoMigrate.message}</p>
                {storage.autoMigrate.waitingOn.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-4 opacity-80">
                    {storage.autoMigrate.waitingOn.includes("r2") && (
                      <li>
                        Add free Cloudflare R2 credentials (`R2_*`) in Vercel →
                        Redeploy
                      </li>
                    )}
                    {storage.autoMigrate.waitingOn.includes("blob_reads") && (
                      <li>
                        Briefly reactivate/unsuspend the Vercel Blob store so
                        files can be copied (billing shows Inactive/Suspended).
                        Auto-move resumes on its own every 5 minutes.
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
            {migrateLog && (
              <p className="mt-1 text-[11px] opacity-70">{migrateLog}</p>
            )}
          </div>
        )}

        {storage?.dualMode && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white/75">
            <p className="font-semibold text-white/90">Dual storage on</p>
            <p className="mt-1 text-xs text-white/55">
              New mass uploads prefer R2. Existing Blob episodes auto-move to R2
              when Blob reads work again. Catalog URLs update automatically —
              no reupload.
            </p>
          </div>
        )}

        {storage?.health?.suspended && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-sm text-amber-50">
            <p className="font-semibold">Vercel Blob store suspended</p>
            <p className="mt-1 text-xs text-amber-100/80">
              Files are still listed ({storage.autoMigrate?.pending ?? "?"} on
              Blob) but content reads return 403, so they cannot be copied yet.
              Set R2_*, then briefly unsuspend/reactivate Blob — auto-migrate
              copies everything and rewrites the catalog. After that you can
              leave Blob suspended.
            </p>
          </div>
        )}

        <h3 className="text-sm font-semibold text-white/70">
          Vercel Blob (legacy / fallback)
        </h3>

        {storageLoading && !report ? (
          <p className="text-sm text-white/45">Loading storage report…</p>
        ) : storage && !storage.ok && !report ? (
          <p className="text-sm text-red-300/90">
            {storage.message || storage.error || "Storage unavailable"}
          </p>
        ) : report && !report.configured ? (
          <p className="text-sm text-white/45">
            Blob not configured — optional once R2 is set.{" "}
            <span className="text-white/70">BLOB_READ_WRITE_TOKEN</span> enables
            legacy graphs and orphan purge.
          </p>
        ) : report ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/40">
                  Total
                </p>
                <p className="mt-1 font-display text-xl font-bold">
                  {storage?.formatted?.total ?? formatBytes(report.totals.bytes)}
                </p>
                <p className="text-xs text-white/40">
                  {report.totals.objects} objects
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/40">
                  Active videos
                </p>
                <p className="mt-1 font-display text-xl font-bold">
                  {storage?.formatted?.active ?? formatBytes(report.activeBytes)}
                </p>
                <p className="text-xs text-white/40">
                  {report.catalog.videos} catalog episodes
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/40">
                  Orphans
                </p>
                <p className="mt-1 font-display text-xl font-bold">
                  {storage?.formatted?.orphans ??
                    formatBytes(report.orphans.bytes)}
                </p>
                <p className="text-xs text-white/40">
                  {report.orphans.files} file
                  {report.orphans.files === 1 ? "" : "s"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/40">
                  Reclaimable
                </p>
                <p className="mt-1 font-display text-xl font-bold text-[var(--slop-violet)]">
                  {storage?.formatted?.reclaimable ??
                    formatBytes(report.reclaimableBytes)}
                </p>
                <p className="text-xs text-white/40">
                  {report.duplicates.files} duplicate
                  {report.duplicates.files === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/80">
                  Storage breakdown
                </h3>
                <StackedShareBar
                  formatValue={formatBytes}
                  segments={[
                    {
                      label: "Active",
                      value: report.activeBytes,
                      color: "var(--slop-violet)",
                    },
                    {
                      label: "Orphans",
                      value: report.orphans.bytes,
                      color: "#f59e0b",
                    },
                    {
                      label: "Duplicates",
                      value: report.duplicates.bytes,
                      color: "#f87171",
                    },
                  ]}
                />
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/80">
                  Size by series
                </h3>
                <SimpleBars
                  labelWidth={120}
                  formatValue={formatBytes}
                  data={report.dramas.slice(0, 10).map((d, i) => ({
                    label: d.title,
                    value: d.bytes,
                    color:
                      d.inCatalogEpisodes === 0
                        ? "#f59e0b"
                        : i === 0
                          ? "var(--slop-violet)"
                          : "rgba(185, 154, 255, 0.55)",
                  }))}
                />
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/80">
                  Episodes on Blob by series
                </h3>
                <ColumnChart
                  height={140}
                  data={report.dramas.slice(0, 12).map((d, i) => ({
                    label: d.title.slice(0, 10),
                    value: d.uniqueEpisodes,
                    color:
                      d.inCatalogEpisodes === 0
                        ? "#f59e0b"
                        : i === 0
                          ? "var(--slop-violet)"
                          : "rgba(185, 154, 255, 0.55)",
                  }))}
                />
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/80">
                  Files vs catalog episodes
                </h3>
                <SimpleBars
                  labelWidth={120}
                  data={report.dramas.slice(0, 10).map((d) => ({
                    label: d.title,
                    value: d.files,
                    color:
                      d.files > d.inCatalogEpisodes
                        ? "#f59e0b"
                        : "var(--slop-violet)",
                  }))}
                />
              </div>
            </div>

            {report.dramas.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-white/40">
                      <th className="py-2 pr-3 font-medium">Series</th>
                      <th className="py-2 pr-3 font-medium">Files</th>
                      <th className="py-2 pr-3 font-medium">Eps</th>
                      <th className="py-2 font-medium">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.dramas.slice(0, 12).map((d) => (
                      <tr
                        key={d.dramaId}
                        className="border-b border-white/5 text-white/80"
                      >
                        <td className="py-2 pr-3">
                          <span className="font-medium text-white">
                            {d.title}
                          </span>
                          {d.inCatalogEpisodes === 0 && (
                            <span className="ml-2 text-xs text-amber-300/80">
                              not in catalog
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{d.files}</td>
                        <td className="py-2 pr-3 tabular-nums">
                          {d.uniqueEpisodes}
                          {d.inCatalogEpisodes > 0
                            ? ` / ${d.inCatalogEpisodes}`
                            : ""}
                        </td>
                        <td className="py-2 tabular-nums">
                          {formatBytes(d.bytes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </section>

      <MassUpload dramas={dramas} />

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-semibold">
          {editingId ? "Edit episode" : "Add / publish episode"}
        </h2>
        <select
          className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm"
          value={form.dramaId}
          onChange={(e) => setForm({ ...form, dramaId: e.target.value })}
        >
          <option value="">Select drama</option>
          {dramas.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min={1}
          placeholder="Episode number"
          value={form.episodeNumber}
          onChange={(e) =>
            setForm({ ...form, episodeNumber: Number(e.target.value) || 1 })
          }
        />
        <Input
          placeholder="Episode title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <Textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <Input
          placeholder="Video delivery URL"
          value={form.videoUrl}
          onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
        />
        <Input
          placeholder="Thumbnail URL"
          value={form.thumbnailUrl}
          onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
        />
        <Input
          placeholder="Tags (comma separated)"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
        />
        <Input
          placeholder="Source attribution (drama title)"
          value={form.sourceAttribution}
          onChange={(e) =>
            setForm({ ...form, sourceAttribution: e.target.value })
          }
        />
        <Textarea
          placeholder="Licensing / ownership notes"
          value={form.licensingNotes}
          onChange={(e) =>
            setForm({ ...form, licensingNotes: e.target.value })
          }
        />
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const on = form.categoryIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    categoryIds: on
                      ? form.categoryIds.filter((id) => id !== c.id)
                      : [...form.categoryIds, c.id],
                  })
                }
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  on
                    ? "bg-[var(--slop-violet)] text-[var(--slop-black)]"
                    : "bg-white/10 text-white/70"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 text-sm"
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value as PublicationStatus,
              })
            }
          >
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) =>
                setForm({ ...form, featured: e.target.checked })
              }
            />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.autoPostSocial}
              onChange={(e) =>
                setForm({ ...form, autoPostSocial: e.target.checked })
              }
            />
            Auto-post Ep 1–2 to socials on publish
          </label>
        </div>
        <p className="text-xs text-white/40">
          When you publish episode 1 or 2, SLOP posts a watch link to every
          connected social channel. Configure channels in{" "}
          <a href="/admin/social" className="text-[var(--slop-violet)]">
            Social auto-post
          </a>
          .
        </p>
        {form.videoUrl && (
          <video
            src={form.videoUrl}
            controls
            className="max-h-48 w-full rounded-xl bg-black"
          />
        )}
        <div className="flex gap-2">
          <Button onClick={save}>{editingId ? "Update" : "Save"}</Button>
          {editingId && (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleSelectAll}
                disabled={sortedVideos.length === 0}
              />
              Select all
            </label>
            {selected.size > 0 && (
              <span className="text-xs text-white/45">
                {selected.size} selected
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="danger"
            disabled={selected.size === 0 || bulkBusy}
            onClick={() => void bulkDelete()}
          >
            {bulkBusy
              ? "Deleting…"
              : selected.size > 0
                ? `Delete selected (${selected.size})`
                : "Delete selected"}
          </Button>
        </div>

        {sortedVideos.map((video) => (
          <div
            key={video.id}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.has(video.id)}
                onChange={() => toggleSelect(video.id)}
                aria-label={`Select ${video.title}`}
              />
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  EP {String(video.episodeNumber).padStart(2, "0")} ·{" "}
                  {video.title}
                </p>
                <p className="text-xs text-white/45">
                  {video.sourceAttribution} · {video.status} · {video.viewCount}{" "}
                  views
                </p>
              </div>
            </div>
            <div className="flex gap-2 pl-7 sm:pl-0">
              <Button size="sm" variant="secondary" onClick={() => edit(video)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const publishing = video.status !== "published";
                  const next = {
                    ...video,
                    status: (publishing
                      ? "published"
                      : "unpublished") as PublicationStatus,
                    publishedAt: publishing
                      ? video.publishedAt ?? new Date().toISOString()
                      : video.publishedAt,
                  };
                  upsertVideo(next);
                  if (publishing && video.episodeNumber <= 2) {
                    const drama = dramas.find((d) => d.id === video.dramaId);
                    if (drama) {
                      const toastId = toast.loading(
                        `Auto-posting Ep ${video.episodeNumber}…`,
                      );
                      try {
                        const result = await triggerEpisodeAutoPost({
                          dramaId: drama.id,
                          dramaTitle: drama.title,
                          dramaSlug: drama.slug,
                          episodeId: video.id,
                          episodeNumber: video.episodeNumber,
                          episodeTitle: video.title,
                          episodeSlug: video.slug,
                          description: video.description,
                          thumbnailUrl: video.thumbnailUrl,
                          videoUrl: video.videoUrl,
                        });
                        if (result.skipped) {
                          toast.message(result.message || "Auto-post skipped", {
                            id: toastId,
                          });
                        } else if (result.ok) {
                          toast.success(
                            result.message || "Posted to socials",
                            { id: toastId },
                          );
                        } else {
                          toast.error(
                            result.message || "Social auto-post failed",
                            { id: toastId },
                          );
                        }
                      } catch {
                        toast.error("Social auto-post request failed", {
                          id: toastId,
                        });
                      }
                    }
                  }
                }}
              >
                {video.status === "published" ? "Unpublish" : "Publish"}
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  const confirmed = window.confirm(
                    `Delete “${video.title}” and free its video storage?`,
                  );
                  if (!confirmed) return;
                  void deleteEpisodes([video]);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
