"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { rankUploadFiles } from "@/lib/episodes/filename";
import {
  enqueueMassUpload,
  isUploadRunning,
  subscribeUploadQueue,
  type CloudTarget,
  type UploadBatch,
} from "@/lib/admin-upload-queue";
import type { Drama, PublicationStatus } from "@/lib/types";
import { slugify, uid } from "@/lib/utils";
import { useSlopStore } from "@/store/slop-store";
import { toast } from "sonner";

type PickedRow = {
  file: File;
  episodeNumber: number;
  label: string;
  parsed: boolean;
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

export function MassUpload({ dramas }: { dramas: Drama[] }) {
  const categories = useSlopStore((s) => s.categories);
  const upsertDrama = useSlopStore((s) => s.upsertDrama);
  const inputRef = useRef<HTMLInputElement>(null);

  const [dramaId, setDramaId] = useState(dramas[0]?.id ?? NEW_DRAMA);
  const [status, setStatus] = useState<PublicationStatus>("published");
  const [picked, setPicked] = useState<PickedRow[]>([]);
  const [cloudTarget, setCloudTarget] = useState<CloudTarget>("r2");
  const [adminKey, setAdminKey] = useState("");
  const [uploadReady, setUploadReady] = useState<
    "unknown" | "ready" | "needs-key" | "no-cloud" | "suspended"
  >("unknown");
  const [readyMessage, setReadyMessage] = useState("");
  const [preferredCloud, setPreferredCloud] = useState<"r2" | "blob" | "none">(
    "none",
  );
  const [batch, setBatch] = useState<UploadBatch | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newSynopsis, setNewSynopsis] = useState("");
  const [newGenreIds, setNewGenreIds] = useState<string[]>([]);
  const [newPosterUrl, setNewPosterUrl] = useState("");

  useEffect(() => subscribeUploadQueue(setBatch), []);

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
        const preferred =
          data.preferred === "r2" || data.preferred === "blob"
            ? data.preferred
            : "none";
        setPreferredCloud(preferred);
        if (preferred !== "none") {
          setCloudTarget(preferred);
        }

        if (preferred === "none") {
          if (data.blobSuspended && !data.r2Ok) {
            setUploadReady("suspended");
            setReadyMessage(
              data.message ||
                "Vercel Blob is suspended. Add free Cloudflare R2 credentials (R2_*) to keep uploading.",
            );
            return;
          }
          setUploadReady("no-cloud");
          setReadyMessage(
            data.message ||
              "No cloud storage ready. Configure Cloudflare R2 (free) or Vercel Blob.",
          );
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
  const queueBusy = Boolean(batch?.running);

  const activeCats = categories
    .filter((c) => c.active)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const summary = useMemo(() => {
    const parsed = picked.filter((r) => r.parsed).length;
    return { parsed, orphan: picked.length - parsed };
  }, [picked]);

  const displayRows = useMemo(() => {
    if (batch?.jobs?.length) {
      return batch.jobs.map((j) => ({
        key: j.id,
        episodeNumber: j.episodeNumber,
        label: j.label,
        parsed: j.parsed,
        sizeMb: (j.file.size / (1024 * 1024)).toFixed(1),
        status: j.status,
        progress: j.progress,
        error: j.error,
      }));
    }
    return picked.map((r, i) => ({
      key: `${r.label}-${i}`,
      episodeNumber: r.episodeNumber,
      label: r.label,
      parsed: r.parsed,
      sizeMb: (r.file.size / (1024 * 1024)).toFixed(1),
      status: "queued" as const,
      progress: 0,
      error: undefined as string | undefined,
    }));
  }, [batch, picked]);

  const onPick = (list: FileList | null) => {
    if (!list?.length) return;
    if (isUploadRunning()) {
      toast.error("Wait for the current background upload to finish");
      return;
    }
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
    const ranked = rankUploadFiles(files);
    setPicked(ranked);
    toast.success(
      `Sorted ${ranked.length} file${ranked.length === 1 ? "" : "s"} by episode number`,
    );
  };

  const resolveDrama = (): Drama | null => {
    if (!creatingNew) return existingDrama ?? null;

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
    const poster = newPosterUrl.trim() || "/posters/blood-contract.jpg";

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

  const startUpload = () => {
    if (picked.length === 0) {
      toast.error("Choose EP## MP4 files to upload");
      return;
    }
    if (uploadReady === "needs-key" && !adminKey.trim()) {
      toast.error("Paste the admin upload key first");
      return;
    }
    if (uploadReady === "suspended" || uploadReady === "no-cloud") {
      toast.error(
        readyMessage ||
          "Cloud storage is not ready. Configure Cloudflare R2 (free) first.",
      );
      return;
    }

    const drama = resolveDrama();
    if (!drama) return;

    const result = enqueueMassUpload({
      drama,
      publishStatus: status,
      adminKey,
      cloudTarget:
        uploadReady === "ready"
          ? cloudTarget
          : preferredCloud === "blob"
            ? "blob"
            : "r2",
      files: picked,
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.message(
      `Uploading ${picked.length} episodes in the background — you can leave this page`,
    );
    setPicked([]);
  };

  const canUpload =
    picked.length > 0 &&
    !queueBusy &&
    (creatingNew ? newTitle.trim().length > 0 : Boolean(existingDrama));

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--slop-violet)]/30 bg-[rgba(185,154,255,0.06)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Mass upload</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Drop MP4s named like{" "}
            <code className="text-[var(--slop-lavender)]">EP49</code> — SLOP
            auto-sorts them and keeps uploading in the background if you leave
            this page. Each episode is saved as soon as it finishes.
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
          disabled={queueBusy}
        />
        <p
          className={`text-xs ${
            uploadReady === "ready"
              ? "text-emerald-400/90"
              : uploadReady === "needs-key" ||
                  uploadReady === "no-cloud" ||
                  uploadReady === "suspended"
                ? "text-amber-300/90"
                : "text-white/40"
          }`}
        >
          {readyMessage ||
            "Cloud uploads need this key on the public deploy."}
        </p>
      </label>

      {(uploadReady === "suspended" || uploadReady === "no-cloud") && (
        <div className="flex gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-50">
              Cloud storage needs Cloudflare R2
            </p>
            <p className="text-xs text-amber-100/80">
              Vercel Blob on Hobby is suspended. Use free Cloudflare R2 instead:
              create a public bucket + API token, set{" "}
              <code className="text-amber-50">R2_ACCOUNT_ID</code>,{" "}
              <code className="text-amber-50">R2_ACCESS_KEY_ID</code>,{" "}
              <code className="text-amber-50">R2_SECRET_ACCESS_KEY</code>,{" "}
              <code className="text-amber-50">R2_BUCKET_NAME</code>, and{" "}
              <code className="text-amber-50">R2_PUBLIC_BASE_URL</code> in Vercel
              env, redeploy, then re-drop remaining EP## files.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/45">
            Drama
          </span>
          <select
            className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm"
            value={dramaId}
            onChange={(e) => setDramaId(e.target.value)}
            disabled={queueBusy}
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
            disabled={queueBusy}
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
              disabled={queueBusy}
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
              disabled={queueBusy}
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
              disabled={queueBusy}
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
                    disabled={queueBusy}
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

      <label className="block space-y-1.5 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/45">
          Cloud storage
        </span>
        <select
          className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm"
          value={cloudTarget}
          onChange={(e) => setCloudTarget(e.target.value as CloudTarget)}
          disabled={queueBusy || uploadReady !== "ready"}
        >
          <option value="r2">Cloudflare R2 (free, recommended)</option>
          <option value="blob">Vercel Blob</option>
          <option value="local">Local public/uploads (dev only)</option>
        </select>
        <p className="text-xs text-white/40">
          Large MP4s upload directly to cloud via signed URLs. R2 is preferred
          while Blob remains suspended.
        </p>
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
        disabled={queueBusy}
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
        className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-black/25 px-4 py-10 text-center transition hover:border-[var(--slop-violet)]/50 hover:bg-black/35 disabled:opacity-50"
      >
        <Upload className="h-7 w-7 text-[var(--slop-violet)]" />
        <span className="font-semibold text-white">
          Drop EP## MP4s here or browse
        </span>
        <span className="text-xs text-white/45">
          Background queue · saves each episode immediately · survives leaving
          this page
        </span>
      </button>

      {displayRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/50">
            <p>
              {displayRows.length} files
              {!batch && summary.parsed
                ? ` · ${summary.parsed} matched EP##`
                : ""}
              {batch?.running ? " · uploading in background…" : ""}
              {creatingNew && newTitle.trim() && !batch
                ? ` · → “${newTitle.trim()}”`
                : ""}
            </p>
            {!queueBusy && picked.length > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setPicked([])}>
                Clear
              </Button>
            ) : null}
          </div>

          <ul className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2">
            {displayRows.map((row) => (
              <li
                key={row.key}
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
                    {row.sizeMb} MB
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

          {!batch?.running && picked.length > 0 ? (
            <Button
              className="w-full sm:w-auto"
              disabled={!canUpload}
              onClick={startUpload}
            >
              {creatingNew ? (
                <>
                  Create “{newTitle.trim() || "drama"}” + upload{" "}
                  {picked.length}
                </>
              ) : (
                <>Start background upload ({picked.length})</>
              )}
            </Button>
          ) : null}

          {queueBusy ? (
            <p className="text-xs text-white/45">
              Upload continues if you navigate away. Keep this browser tab open
              until the floating progress dock finishes.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
