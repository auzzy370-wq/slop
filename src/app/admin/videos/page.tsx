"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSlopStore } from "@/store/slop-store";
import type { PublicationStatus, Video } from "@/lib/types";
import { triggerEpisodeAutoPost } from "@/lib/social/client";
import { slugify, uid } from "@/lib/utils";
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

export default function AdminVideosPage() {
  const videos = useSlopStore((s) => s.videos);
  const dramas = useSlopStore((s) => s.dramas);
  const categories = useSlopStore((s) => s.categories);
  const upsertVideo = useSlopStore((s) => s.upsertVideo);
  const deleteVideo = useSlopStore((s) => s.deleteVideo);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Episode management</h1>
        <p className="mt-1 text-sm text-white/50">
          Only admins publish episodes. Users cannot upload or generate videos.
        </p>
      </div>

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

      <section className="space-y-2">
        {videos.map((video) => (
          <div
            key={video.id}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold">
                EP {video.episodeNumber} · {video.title}
              </p>
              <p className="text-xs text-white/45">
                {video.sourceAttribution} · {video.status} · {video.viewCount}{" "}
                views
              </p>
            </div>
            <div className="flex gap-2">
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
                  deleteVideo(video.id);
                  toast.success("Episode deleted");
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
