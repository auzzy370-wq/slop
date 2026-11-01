"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MassUpload } from "@/components/admin/mass-upload";
import {
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
            <h2 className="font-semibold">Blob storage</h2>
            <p className="mt-0.5 text-xs text-white/45">
              Live usage across Vercel Blob. Orphans and duplicates can be purged
              without touching catalog episodes.
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
              variant="danger"
              disabled={
                purgeBusy ||
                storageLoading ||
                !report?.configured ||
                reclaimable <= 0
              }
              onClick={() => void purgeOrphans()}
            >
              {purgeBusy
                ? "Purging…"
                : reclaimable > 0
                  ? `Purge orphans (${storage?.formatted?.reclaimable ?? formatBytes(reclaimable)})`
                  : "Nothing to purge"}
            </Button>
          </div>
        </div>

        {storageLoading && !report ? (
          <p className="text-sm text-white/45">Loading storage report…</p>
        ) : storage && !storage.ok && !report ? (
          <p className="text-sm text-red-300/90">
            {storage.message || storage.error || "Storage unavailable"}
          </p>
        ) : report && !report.configured ? (
          <p className="text-sm text-white/45">
            Blob not configured — set{" "}
            <span className="text-white/70">BLOB_READ_WRITE_TOKEN</span> to track
            cloud storage.
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
