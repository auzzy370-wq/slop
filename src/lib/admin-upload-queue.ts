"use client";

import { upload } from "@vercel/blob/client";
import {
  clearUploadCheckpoint,
  markCheckpointEpisodeDone,
} from "@/lib/admin-upload-checkpoint";
import {
  formatEpisodeTitle,
  type RankedUploadFile,
} from "@/lib/episodes/filename";
import type { Drama, PublicationStatus, Video } from "@/lib/types";
import { slugify, uid } from "@/lib/utils";
import { useSlopStore } from "@/store/slop-store";

const ADMIN_KEY_STORAGE = "slop_admin_key";

/** Episode already exists for this drama — block double uploads unless forceReplace. */
export function episodeAlreadyExists(
  dramaId: string,
  episodeNumber: number,
): boolean {
  return useSlopStore
    .getState()
    .videos.some(
      (v) =>
        v.dramaId === dramaId &&
        v.episodeNumber === episodeNumber &&
        Boolean(v.videoUrl?.trim()),
    );
}

/** @deprecated use episodeAlreadyExists */
export function episodeAlreadyDurable(
  dramaId: string,
  episodeNumber: number,
): boolean {
  return episodeAlreadyExists(dramaId, episodeNumber);
}

let wakeLock: WakeLockSentinel | null = null;

async function requestWakeLock() {
  try {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null;
  }
}

async function releaseWakeLock() {
  try {
    await wakeLock?.release();
  } catch {
    /* ignore */
  }
  wakeLock = null;
}

function reacquireWakeLockOnVisible() {
  if (document.visibilityState === "visible" && activeBatch?.running) {
    void requestWakeLock();
  }
}

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

export type CloudTarget = "auto" | "r2" | "supabase" | "blob" | "local";
export type ResolvedCloudTarget = "r2" | "supabase" | "blob" | "local";

export type UploadBatch = {
  id: string;
  drama: Drama;
  publishStatus: PublicationStatus;
  adminKey: string;
  /** @deprecated use cloudTarget */
  preferBlob: boolean;
  cloudTarget: CloudTarget;
  /** Spillover order for auto (R2 → Supabase → Blob). */
  autoOrder: ResolvedCloudTarget[];
  /** When true, re-upload even if episode already has a durable (non-Blob) URL. */
  forceReplace: boolean;
  jobs: QueueJob[];
  running: boolean;
  startedAt: number;
  finishedAt?: number;
  skippedDurable?: number;
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
  if (/store has been suspended|store is blocked|blob.*suspended/i.test(raw)) {
    return "Vercel Blob is suspended. Switch mass upload to Auto / Cloudflare R2 / Supabase, or unsuspend Blob.";
  }
  if (/r2_not_configured|R2_/i.test(raw)) {
    return "Cloudflare R2 is not configured — set R2_* env vars (see README).";
  }
  if (/supabase_not_configured|SUPABASE_SERVICE_ROLE/i.test(raw)) {
    return "Supabase Storage is not configured — set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.";
  }
  if (/blob_not_configured|BLOB_READ_WRITE_TOKEN/i.test(raw)) {
    return "Cloud storage not configured (set R2_*, Supabase, or BLOB_READ_WRITE_TOKEN).";
  }
  if (/use_blob/i.test(raw)) {
    return "This host needs cloud storage (R2, Supabase, or Blob) for MP4 uploads.";
  }
  if (/no_cloud_storage|free.?tier pool|none ready/i.test(raw)) {
    return "No free-tier cloud storage is ready. Configure R2, Supabase Storage, or Blob.";
  }
  return raw;
}

function isFatalUploadError(raw: string) {
  return /store has been suspended|store is blocked|blob.*suspended|r2_not_configured|supabase_not_configured|BLOB_READ_WRITE_TOKEN|not configured|use_blob|no_cloud_storage|Admin key missing/i.test(
    raw,
  );
}

function isSpillableCloudError(raw: string) {
  return /suspended|blocked|not configured|r2_not_configured|supabase_not_configured|BLOB_READ_WRITE_TOKEN|quota|storage.*limit|payload too large|entity too large|413/i.test(
    raw,
  );
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

async function uploadR2(
  file: File,
  dramaId: string,
  episodeNumber: number,
  adminKey?: string,
): Promise<string> {
  const contentType = file.type || "video/mp4";
  const presignRes = await fetch("/api/admin/videos/r2", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...adminHeaders(adminKey),
    },
    body: JSON.stringify({
      action: "presign",
      dramaId,
      episodeNumber,
      filename: file.name,
      contentType,
    }),
  });
  const presign = (await presignRes.json().catch(() => ({}))) as {
    ok?: boolean;
    uploadUrl?: string;
    publicUrl?: string;
    message?: string;
    error?: string;
  };
  if (!presignRes.ok || !presign.uploadUrl || !presign.publicUrl) {
    throw new Error(
      friendlyUploadError(
        presign.message || presign.error || "R2 presign failed",
      ),
    );
  }

  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": contentType,
    },
    body: file,
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    throw new Error(
      friendlyUploadError(
        text || `R2 upload failed (HTTP ${putRes.status})`,
      ),
    );
  }
  return presign.publicUrl;
}

async function uploadSupabase(
  file: File,
  dramaId: string,
  episodeNumber: number,
  adminKey?: string,
): Promise<string> {
  const contentType = file.type || "video/mp4";
  const presignRes = await fetch("/api/admin/videos/supabase", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...adminHeaders(adminKey),
    },
    body: JSON.stringify({
      action: "presign",
      dramaId,
      episodeNumber,
      filename: file.name,
      contentType,
    }),
  });
  const presign = (await presignRes.json().catch(() => ({}))) as {
    ok?: boolean;
    uploadUrl?: string;
    publicUrl?: string;
    message?: string;
    error?: string;
  };
  if (!presignRes.ok || !presign.uploadUrl || !presign.publicUrl) {
    throw new Error(
      friendlyUploadError(
        presign.message ||
          presign.error ||
          "Supabase signed upload failed",
      ),
    );
  }

  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": contentType,
      "x-upsert": "true",
    },
    body: file,
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    throw new Error(
      friendlyUploadError(
        text || `Supabase upload failed (HTTP ${putRes.status})`,
      ),
    );
  }
  return presign.publicUrl;
}

async function uploadToTarget(
  target: ResolvedCloudTarget,
  file: File,
  dramaId: string,
  episodeNumber: number,
  adminKey?: string,
): Promise<string> {
  if (target === "r2") {
    return uploadR2(file, dramaId, episodeNumber, adminKey);
  }
  if (target === "supabase") {
    return uploadSupabase(file, dramaId, episodeNumber, adminKey);
  }
  if (target === "blob") {
    return uploadBlob(file, dramaId, episodeNumber, adminKey);
  }
  return uploadLocal(file, dramaId, episodeNumber, adminKey);
}

async function resolveAutoOrder(
  adminKey: string,
): Promise<ResolvedCloudTarget[]> {
  try {
    const res = await fetch("/api/admin/videos/upload-status", {
      headers: adminHeaders(adminKey),
    });
    const data = (await res.json().catch(() => ({}))) as {
      order?: string[];
      preferred?: string;
    };
    const order = (data.order || []).filter(
      (id): id is ResolvedCloudTarget =>
        id === "r2" || id === "supabase" || id === "blob",
    );
    if (order.length) return order;
    if (
      data.preferred === "r2" ||
      data.preferred === "supabase" ||
      data.preferred === "blob"
    ) {
      return [data.preferred];
    }
  } catch {
    /* fall through */
  }
  return ["r2", "supabase", "blob"];
}

async function uploadWithSpillover(
  order: ResolvedCloudTarget[],
  file: File,
  dramaId: string,
  episodeNumber: number,
  adminKey?: string,
): Promise<string> {
  const errors: string[] = [];
  for (let i = 0; i < order.length; i++) {
    const target = order[i]!;
    try {
      return await uploadToTarget(
        target,
        file,
        dramaId,
        episodeNumber,
        adminKey,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${target}: ${msg}`);
      const canSpill =
        i < order.length - 1 && isSpillableCloudError(msg);
      if (!canSpill) throw err;
    }
  }
  throw new Error(
    friendlyUploadError(
      errors.join(" · ") || "no_cloud_storage — free-tier pool none ready",
    ),
  );
}

/**
 * Persist drama + every known episode for that series.
 * Sending the full set avoids lost updates when Blob catalog reads are stale
 * mid-batch (each single-episode save used to overwrite a lagging snapshot).
 */
async function persistCatalog(
  drama: Drama,
  videos: Video[],
  adminKey: string,
) {
  const res = await fetch("/api/admin/catalog/uploads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders(adminKey),
    },
    body: JSON.stringify({ dramas: [drama], videos }),
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
  await requestWakeLock();
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", reacquireWakeLockOnVisible);
  }

  let drama = batch.drama;
  const totalPlanned = batch.jobs.length;

  for (const job of batch.jobs) {
    if (job.status === "done") continue;

    // Never double-upload the same EP for a drama unless forceReplace is on.
    if (
      !batch.forceReplace &&
      episodeAlreadyExists(drama.id, job.episodeNumber)
    ) {
      patchJob(job.id, {
        status: "done",
        progress: 100,
        error: undefined,
      });
      markCheckpointEpisodeDone({
        dramaId: drama.id,
        dramaTitle: drama.title,
        cloudTarget: batch.cloudTarget,
        publishStatus: batch.publishStatus,
        episodeNumber: job.episodeNumber,
        fileName: job.file.name,
        totalPlanned,
      });
      continue;
    }

    patchJob(job.id, {
      status: "uploading",
      progress: 8,
      error: undefined,
    });

    try {
      let url: string;
      const target = batch.cloudTarget || (batch.preferBlob ? "blob" : "auto");
      if (target === "auto") {
        const order =
          batch.autoOrder.length > 0
            ? batch.autoOrder
            : await resolveAutoOrder(batch.adminKey);
        if (activeBatch) activeBatch.autoOrder = order;
        url = await uploadWithSpillover(
          order,
          job.file,
          drama.id,
          job.episodeNumber,
          batch.adminKey,
        );
      } else if (target === "local") {
        url = await uploadLocal(
          job.file,
          drama.id,
          job.episodeNumber,
          batch.adminKey,
        );
      } else {
        try {
          url = await uploadToTarget(
            target,
            job.file,
            drama.id,
            job.episodeNumber,
            batch.adminKey,
          );
        } catch (primaryErr) {
          const msg =
            primaryErr instanceof Error
              ? primaryErr.message
              : String(primaryErr);
          // Forced target failed — spill into the free-tier pool when possible.
          if (isSpillableCloudError(msg)) {
            const order = (
              batch.autoOrder.length
                ? batch.autoOrder
                : await resolveAutoOrder(batch.adminKey)
            ).filter((id) => id !== target);
            if (order.length) {
              url = await uploadWithSpillover(
                order,
                job.file,
                drama.id,
                job.episodeNumber,
                batch.adminKey,
              );
            } else {
              throw primaryErr;
            }
          } else {
            throw primaryErr;
          }
        }
      }

      patchJob(job.id, { progress: 55 });
      const durationSeconds = await readDuration(job.file);
      const title = formatEpisodeTitle(job.episodeNumber, job.file.name);
      const existing = useSlopStore
        .getState()
        .videos.find(
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
      // Cumulative save: every episode already in the store for this drama,
      // so a stale server snapshot can't drop earlier uploads in this batch.
      const dramaVideos = useSlopStore
        .getState()
        .videos.filter((v) => v.dramaId === drama.id);
      await persistCatalog(drama, dramaVideos, batch.adminKey);

      patchJob(job.id, {
        status: "done",
        progress: 100,
        url,
        error: undefined,
      });

      markCheckpointEpisodeDone({
        dramaId: drama.id,
        dramaTitle: drama.title,
        cloudTarget: batch.cloudTarget,
        publishStatus: batch.publishStatus,
        episodeNumber: job.episodeNumber,
        fileName: job.file.name,
        totalPlanned,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Upload failed";
      patchJob(job.id, {
        status: "error",
        progress: 0,
        error: message,
      });

      // Fatal cloud/config errors will fail every remaining job — abort the rest.
      if (isFatalUploadError(message) && activeBatch) {
        const skipMsg = /suspended|blocked|no_cloud|none ready/i.test(message)
          ? `Skipped — free-tier pool unavailable (fix R2 / Supabase / Blob, then re-upload from EP ${String(job.episodeNumber).padStart(2, "0")} onward)`
          : `Skipped — ${message}`;
        activeBatch = {
          ...activeBatch,
          jobs: activeBatch.jobs.map((j) =>
            j.status === "queued"
              ? { ...j, status: "error", progress: 0, error: skipMsg }
              : j,
          ),
        };
        emit();
        break;
      }
    }
  }

  if (activeBatch) {
    activeBatch.running = false;
    activeBatch.finishedAt = Date.now();
    const allDone = activeBatch.jobs.every((j) => j.status === "done");
    if (allDone) clearUploadCheckpoint();
    emit();
  }
  processing = false;
  if (typeof document !== "undefined") {
    document.removeEventListener(
      "visibilitychange",
      reacquireWakeLockOnVisible,
    );
  }
  await releaseWakeLock();
}

export function enqueueMassUpload(opts: {
  drama: Drama;
  publishStatus: PublicationStatus;
  adminKey: string;
  preferBlob?: boolean;
  cloudTarget?: CloudTarget;
  autoOrder?: ResolvedCloudTarget[];
  files: RankedUploadFile[];
  /** Re-upload episodes that already have durable cloud URLs. */
  forceReplace?: boolean;
}):
  | { ok: true; queued: number; skippedDurable: number }
  | { ok: false; error: string } {
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

  const cloudTarget: CloudTarget =
    opts.cloudTarget || (opts.preferBlob === false ? "local" : "auto");
  const autoOrder = (opts.autoOrder || []).filter(
    (id): id is ResolvedCloudTarget =>
      id === "r2" || id === "supabase" || id === "blob",
  );
  const forceReplace = Boolean(opts.forceReplace);

  // Also drop duplicate EP## inside this batch (keep first only).
  const seenEp = new Set<number>();
  const dedupedFiles = opts.files.filter((f) => {
    if (seenEp.has(f.episodeNumber)) return false;
    seenEp.add(f.episodeNumber);
    return true;
  });

  let skippedDurable = 0;
  const files = forceReplace
    ? dedupedFiles
    : dedupedFiles.filter((f) => {
        const skip = episodeAlreadyExists(opts.drama.id, f.episodeNumber);
        if (skip) skippedDurable += 1;
        return !skip;
      });

  if (files.length === 0) {
    clearUploadCheckpoint();
    return {
      ok: false,
      error:
        skippedDurable > 0
          ? `All ${skippedDurable} selected episode${skippedDurable === 1 ? "" : "s"} already exist for this series. Turn on “Force re-upload” only if you mean to replace them.`
          : "No files to upload.",
    };
  }

  activeBatch = {
    id: uid("batch"),
    drama: opts.drama,
    publishStatus: opts.publishStatus,
    adminKey: opts.adminKey,
    preferBlob: cloudTarget === "blob",
    cloudTarget,
    autoOrder,
    forceReplace,
    skippedDurable,
    startedAt: Date.now(),
    running: true,
    jobs: files.map((f) => ({
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
  return { ok: true, queued: files.length, skippedDurable };
}

export function clearFinishedUploadBatch() {
  if (activeBatch?.running) return;
  activeBatch = null;
  emit();
}
