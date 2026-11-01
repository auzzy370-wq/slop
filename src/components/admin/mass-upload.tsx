"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  CheckCircle2,
  FileVideo,
  Loader2,
  Plus,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const NEW_DRAMA = "__new__";
const ADMIN_KEY_STORAGE = "slop_admin_key";

function adminHeaders(keyOverride?: string): HeadersInit {
  if (typeof window === "undefined") return {};
  const key =
    keyOverride?.trim() ||
    window.localStorage.getItem(ADMIN_KEY_STORAGE) ||
    "";
  return key ? { "x-slop-admin-key": key } : {};
}

function friendlyUploadError(raw: string) {
  if (/client token|unauthorized|admin key|admin_writes_locked/i.test(raw)) {
    return "Admin key missing or wrong — paste SLOP_ADMIN_KEY below, then retry.";
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
      friendlyUploadError(
        data.message || data.error || "Local upload failed",
      ),
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
    const raw = err instanceof Error ? err.message : String(err);
    throw new Error(friendlyUploadError(raw));
  }
}

export function MassUpload({ dramas }: { dramas: Drama[] }) {
  const videos = useSlopStore((s) => s.videos);
  const categories = useSlopStore((s) => s.categories);
  const upsertVideo = useSlopStore((s) => s.upsertVideo);
  const upsertDrama = useSlopStore((s) => s.upsertDrama);
  const inputRef = useRef<HTMLInputElement>(null);

  const [dramaId, setDramaId] = useState(dramas[0]?.id ?? NEW_DRAMA);
  const [status, setStatus] = useState<PublicationStatus>("published");
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [preferBlob, setPreferBlob] = useState(true);
  const [adminKey, setAdminKey] = useState("");
  const [uploadReady, setUploadReady] = useState<
    "unknown" | "ready" | "needs-key" | "no-blob"
  >("unknown");
  const [readyMessage, setReadyMessage] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newSynopsis, setNewSynopsis] = useState("");
  const [newGenreIds, setNewGenreIds] = useState<string[]>([]);
  const [newPosterUrl, setNewPosterUrl] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(ADMIN_KEY_STORAGE) ?? "";
    setAdminKey(saved);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const res = await fetch("/api/admin/videos/upload-status", {
          headers: adminHeaders(adminKey),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setUploadReady("needs-key");
          setReadyMessage(
            data.message ||
              "Paste SLOP_ADMIN_KEY to unlock cloud uploads on this deploy.",
          );
          return;
        }
        if (!data.blobConfigured) {
          setUploadReady("no-blob");
          setReadyMessage(data.message || "Blob storage is not configured.");
          return;
        }
        setUploadReady("ready");
        setReadyMessage(data.message || "Ready for cloud mass upload");
      } catch {
        if (!cancelled) {
          setUploadReady("unknown");
          setReadyMessage("Could not check upload status.");
        }
      }
    };
    void probe();
    return () => {
      cancelled = true;
    };
  }, [adminKey]);

  const persistAdminKey = (value: string) => {
    setAdminKey(value);
    if (value.trim()) {
      window.localStorage.setItem(ADMIN_KEY_STORAGE, value.trim());
    } else {
      window.localStorage.removeItem(ADMIN_KEY_STORAGE);
    }
  };

  const creatingNew = dramaId === NEW_DRAMA;
  const existingDrama = creatingNew
    ? undefined
    : dramas.find((d) => d.id === dramaId);

  const activeCats = categories
    .filter((c) => c.active)
    .sort((a, b) => a.displayOrder - b.displayOrder);

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

  const resolveDrama = (): Drama | null => {
    if (!creatingNew) {
      return existingDrama ?? null;
    }

    const title = newTitle.trim();
    if (!title) {
      toast.error("Name the new drama first");
      return null;
    }

    const now = new Date().toISOString();
    const slugBase = slugify(title) || "untitled-drama";
    const slugTaken = dramas.some((d) => d.slug === slugBase);
    const slug = slugTaken ? `${slugBase}-${uid("d").slice(-4)}` : slugBase;
    const genreIds =
      newGenreIds.length > 0
        ? newGenreIds
        : activeCats[0]
          ? [activeCats[0].id]
          : [];
    const poster =
      newPosterUrl.trim() ||
      "/posters/forgotten-wife.jpg";

    const drama: Drama = {
      id: uid("drama"),
      slug,
      title,
      synopsis:
        newSynopsis.trim() ||
        `Original short drama: ${title}. Uploaded via admin mass import.`,
      posterUrl: poster,
      bannerUrl: poster,
      genreIds,
      tags: [title.toLowerCase(), "admin-upload"],
      status: status === "scheduled" ? "published" : status,
      featured: false,
      trendingRank: null,
      episodeCount: 0,
      viewCount: 0,
      likeCount: 0,
      sourceAttribution: title,
      createdAt: now,
      publishedAt: status === "draft" ? null : now,
    };

    upsertDrama(drama);
    setDramaId(drama.id);
    return drama;
  };

  const runUpload = async () => {
    if (rows.length === 0) {
      toast.error("Choose EP## MP4 files to upload");
      return;
    }

    const drama = resolveDrama();
    if (!drama) return;

    setBusy(true);
    let ok = 0;
    let failed = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      patchRow(i, { status: "uploading", progress: 8, error: undefined });
      try {
        let url: string;
        if (preferBlob && uploadReady !== "no-blob") {
          try {
            url = await uploadBlob(
              row.file,
              drama.id,
              row.episodeNumber,
              adminKey,
            );
          } catch (blobErr) {
            const msg =
              blobErr instanceof Error ? blobErr.message : String(blobErr);
            // Only fall back to local disk when Blob truly isn't configured.
            if (/Blob storage not configured|BLOB_READ_WRITE_TOKEN|not configured/i.test(msg)) {
              url = await uploadLocal(
                row.file,
                drama.id,
                row.episodeNumber,
                adminKey,
              );
            } else {
              throw blobErr;
            }
          }
        } else {
          url = await uploadLocal(
            row.file,
            drama.id,
            row.episodeNumber,
            adminKey,
          );
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
          title:
            existing?.title && existing.title !== title
              ? existing.title
              : title,
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

    const maxEp = Math.max(
      drama.episodeCount,
      ...rows.map((r) => r.episodeNumber),
      ...videos
        .filter((v) => v.dramaId === drama.id)
        .map((v) => v.episodeNumber),
    );
    upsertDrama({ ...drama, episodeCount: maxEp });

    setBusy(false);
    if (failed === 0) {
      toast.success(
        `Imported ${ok} episode${ok === 1 ? "" : "s"} into “${drama.title}”`,
      );
    } else {
      toast.error(`Imported ${ok}, failed ${failed}`);
    }
  };

  const canUpload =
    rows.length > 0 &&
    !busy &&
    (creatingNew ? newTitle.trim().length > 0 : Boolean(existingDrama));

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--slop-violet)]/30 bg-[rgba(185,154,255,0.06)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Mass upload</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Drop MP4s named like{" "}
            <code className="text-[var(--slop-lavender)]">EP49</code> — SLOP
            auto-sorts them and publishes into an existing drama or a new one
            you name here.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
          Admin only
        </span>
      </div>

      <label className="block space-y-1.5 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/45">
          Admin upload key
        </span>
        <Input
          type="password"
          autoComplete="off"
          placeholder="Paste SLOP_ADMIN_KEY (required on Vercel)"
          value={adminKey}
          onChange={(e) => persistAdminKey(e.target.value)}
          disabled={busy}
        />
        <p
          className={`text-xs ${
            uploadReady === "ready"
              ? "text-emerald-400/90"
              : uploadReady === "needs-key" || uploadReady === "no-blob"
                ? "text-amber-300/90"
                : "text-white/40"
          }`}
        >
          {readyMessage ||
            "Cloud uploads need this key on the public deploy."}
        </p>
      </label>

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
            <option value={NEW_DRAMA}>+ Create new drama…</option>
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

      {creatingNew && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4 text-[var(--slop-violet)]" />
            New drama details
          </div>
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/45">
              Title
            </span>
            <Input
              placeholder="e.g. Midnight Contract"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              disabled={busy}
              maxLength={120}
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/45">
              Synopsis
            </span>
            <Textarea
              placeholder="One or two sentences about the show (optional)"
              value={newSynopsis}
              onChange={(e) => setNewSynopsis(e.target.value)}
              disabled={busy}
              rows={3}
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/45">
              Poster / banner URL (optional)
            </span>
            <Input
              placeholder="/posters/… or https://…"
              value={newPosterUrl}
              onChange={(e) => setNewPosterUrl(e.target.value)}
              disabled={busy}
            />
          </label>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">
              Genres
            </p>
            <div className="flex flex-wrap gap-2">
              {activeCats.map((c) => {
                const on = newGenreIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setNewGenreIds((prev) =>
                        on
                          ? prev.filter((id) => id !== c.id)
                          : [...prev, c.id],
                      )
                    }
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      on
                        ? "bg-[var(--slop-violet)] text-[var(--slop-black)]"
                        : "bg-white/10 text-white/70 hover:bg-white/15"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
              {creatingNew && newTitle.trim()
                ? ` · → “${newTitle.trim()}”`
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
            disabled={!canUpload}
            onClick={runUpload}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : creatingNew ? (
              <>Create “{newTitle.trim() || "drama"}” + upload {rows.length}</>
            ) : (
              <>Upload {rows.length} episodes</>
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
