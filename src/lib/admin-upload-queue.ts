"use client";

import { upload } from "@vercel/blob/client";
import {
  formatEpisodeTitle,
  type RankedUploadFile,
} from "@/lib/episodes/filename";
import type { Drama, PublicationStatus, Video } from "@/lib/types";
import { slugify, uid } from "@/lib/utils";
import { useSlopStore } from "@/store/slop-store";

const ADMIN_KEY_STORAGE = "slop_admin_key";

export type QueueJob = {
  id: string;
  file: File;
  episodeNumber: number;
  label: string;
  parsed: boolean;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  url?: string;
};

export type UploadBatch = {
  id: string;
  drama: Drama;
  publishStatus: PublicationStatus;
  adminKey: string;
  preferBlob: boolean;
  jobs: QueueJob[];
  running: boolean;
  startedAt: number;
  finishedAt?: number;
};

type Listener = (batch: UploadBatch | null) => void;

let activeBatch: UploadBatch | null = null;
let processing = false;
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn(activeBatch);
}

export function subscribeUploadQueue(fn: Listener) {
  listeners.add(fn);
  fn(activeBatch);
  return () => {
    listeners.delete(fn);
  };
}

export function getUploadBatch() {
  return activeBatch;
}

export function isUploadRunning() {
  return Boolean(activeBatch?.running);
}

function adminHeaders(key?: string): HeadersInit {
  const k =
    key?.trim() ||
    (typeof window !== "undefined"
      ? window.localStorage.getItem(ADMIN_KEY_STORAGE) || ""
      : "");
  return k ? { "x-slop-admin-key": k } : {};
}

function friendlyUploadError(raw: string) {
  if (/client token|unauthorized|admin key|admin_writes_locked/i.test(raw)) {
    return "Admin key missing or wrong — paste SLOP_ADMIN_KEY, then retry.";
  }
  if (/blob_not_configured|BLOB_READ_WRITE_TOKEN/i.test(raw)) {
    return "Cloud storage not configured (BLOB_READ_WRITE_TOKEN).";
  }
  if (/use_blob/i.test(raw)) {
    return "This host needs Vercel Blob for MP4 uploads.";
  }
  return raw;
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
  adminKey?: string,
): Promise<string> {
  const body = new FormData();
  body.set("dramaId", dramaId);
  body.set("episodeNumber", String(episodeNumber));
  body.set("file", file, file.name);
  const res = await fetch("/api/admin/videos/upload", {
    method: "POST",
    headers: adminHeaders(adminKey),
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      friendlyUploadError(data.message || data.error || "Local upload failed"),
    );
  }
  return data.url as string;
}

async function uploadBlob(
  file: File,
  dramaId: string,
  episodeNumber: number,
  adminKey?: string,
): Promise<string> {
  const ep = String(episodeNumber).padStart(2, "0");
  const pathname = `slop/${dramaId}/ep-${ep}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  try {
    const blob = await upload(pathname, file, {
      access: "public",
      handleUploadUrl: "/api/admin/videos/blob",
      headers: adminHeaders(adminKey) as Record<string, string>,
    });
    return blob.url;
  } catch (err) {
    throw new Error(
      friendlyUploadError(err instanceof Error ? err.message : String(err)),
    );
  }
}

async function persistCatalog(drama: Drama, video: Video, adminKey: string) {
  const res = await fetch("/api/admin/catalog/uploads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders(adminKey),
    },
    body: JSON.stringify({ dramas: [drama], videos: [video] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.message ||
        data.error ||
        "Catalog save failed — episode file may exist but won’t list after refresh.",
    );
  }
}

function patchJob(jobId: string, patch: Partial<QueueJob>) {
  if (!activeBatch) return;
  activeBatch = {
    ...activeBatch,
    jobs: activeBatch.jobs.map((j) =>
      j.id === jobId ? { ...j, ...patch } : j,
    ),
  };
  emit();
}

async function processQueue() {
  if (processing || !activeBatch) return;
  processing = true;
  const batch = activeBatch;
  batch.running = true;
  emit();

  const store = useSlopStore.getState();
  let drama = batch.drama;

  for (const job of batch.jobs) {
    if (job.status === "done") continue;
    patchJob(job.id, {
      status: "uploading",
      progress: 8,
      error: undefined,
    });

    try {
      let url: string;
      if (batch.preferBlob) {
        try {
          url = await uploadBlob(
            job.file,
            drama.id,
            job.episodeNumber,
            batch.adminKey,
          );
        } catch (blobErr) {
          const msg =
            blobErr instanceof Error ? blobErr.message : String(blobErr);
          if (
            /Blob storage not configured|BLOB_READ_WRITE_TOKEN|not configured/i.test(
              msg,
            )
          ) {
            url = await uploadLocal(
              job.file,
              drama.id,
              job.episodeNumber,
              batch.adminKey,
            );
          } else {
            throw blobErr;
          }
        }
      } else {
        url = await uploadLocal(
          job.file,
          drama.id,
          job.episodeNumber,
          batch.adminKey,
        );
      }

      patchJob(job.id, { progress: 55 });
      const durationSeconds = await readDuration(job.file);
      const title = formatEpisodeTitle(job.episodeNumber, job.file.name);
      const existing = store.videos.find(
        (v) =>
          v.dramaId === drama.id && v.episodeNumber === job.episodeNumber,
      );
      const now = new Date().toISOString();

      const video: Video = {
        id: existing?.id ?? uid("ep"),
        slug:
          existing?.slug ?? slugify(`${drama.slug}-ep-${job.episodeNumber}`),
        dramaId: drama.id,
        episodeNumber: job.episodeNumber,
        title:
          existing?.title && existing.title !== title
            ? existing.title
            : title,
        description:
          existing?.description ||
          `${drama.title} · Episode ${job.episodeNumber}`,
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
        status: batch.publishStatus,
        featured: existing?.featured ?? false,
        pinned: existing?.pinned ?? false,
        sourceAttribution:
          existing?.sourceAttribution ||
          drama.sourceAttribution ||
          drama.title,
        licensingNotes: existing?.licensingNotes || "Admin mass upload",
        viewCount: existing?.viewCount ?? 0,
        likeCount: existing?.likeCount ?? 0,
        commentCount: existing?.commentCount ?? 0,
        saveCount: existing?.saveCount ?? 0,
        createdAt: existing?.createdAt ?? now,
        publishedAt:
          batch.publishStatus === "published"
            ? (existing?.publishedAt ?? now)
            : null,
        scheduledAt:
          batch.publishStatus === "scheduled" ? now : null,
        commentsDisabled: existing?.commentsDisabled ?? false,
        playback: "video",
      };

      drama = {
        ...drama,
        episodeCount: Math.max(drama.episodeCount, job.episodeNumber),
      };
      useSlopStore.getState().upsertVideo(video);
      useSlopStore.getState().upsertDrama(drama);
      if (activeBatch) activeBatch.drama = drama;

      patchJob(job.id, { progress: 85 });
      await persistCatalog(drama, video, batch.adminKey);

      patchJob(job.id, {
        status: "done",
        progress: 100,
        url,
        error: undefined,
      });
    } catch (err) {
      patchJob(job.id, {
        status: "error",
        progress: 0,
        error: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }

  if (activeBatch) {
    activeBatch.running = false;
    activeBatch.finishedAt = Date.now();
    emit();
  }
  processing = false;
}

export function enqueueMassUpload(opts: {
  drama: Drama;
  publishStatus: PublicationStatus;
  adminKey: string;
  preferBlob: boolean;
  files: RankedUploadFile[];
}): { ok: true } | { ok: false; error: string } {
  if (activeBatch?.running) {
    return {
      ok: false,
      error: "An upload is already running in the background. Wait for it to finish.",
    };
  }

  if (opts.adminKey.trim()) {
    window.localStorage.setItem(ADMIN_KEY_STORAGE, opts.adminKey.trim());
  }

  useSlopStore.getState().upsertDrama(opts.drama);

  activeBatch = {
    id: uid("batch"),
    drama: opts.drama,
    publishStatus: opts.publishStatus,
    adminKey: opts.adminKey,
    preferBlob: opts.preferBlob,
    startedAt: Date.now(),
    running: true,
    jobs: opts.files.map((f) => ({
      id: uid("job"),
      file: f.file,
      episodeNumber: f.episodeNumber,
      label: f.label,
      parsed: f.parsed,
      status: "queued",
      progress: 0,
    })),
  };
  emit();
  void processQueue();
  return { ok: true };
}

export function clearFinishedUploadBatch() {
  if (activeBatch?.running) return;
  activeBatch = null;
  emit();
}
