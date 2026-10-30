"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Share2,
  Volume2,
  VolumeX,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import type { Video } from "@/lib/types";
import { formatCount, uid } from "@/lib/utils";
import { useSlopStore } from "@/store/slop-store";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { track } from "@/lib/analytics/client";

interface VideoCardProps {
  video: Video;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  categoryNames: string[];
}

export function VideoCard({
  video,
  active,
  muted,
  onToggleMute,
  categoryNames,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");
  const scrubRef = useRef<HTMLDivElement>(null);
  const wasPlayingBeforeScrub = useRef(false);

  const user = useSlopStore((s) => s.currentUser);
  const likes = useSlopStore((s) => s.likes);
  const saves = useSlopStore((s) => s.saves);
  const comments = useSlopStore((s) => s.comments);
  const dramas = useSlopStore((s) => s.dramas);
  const toggleLike = useSlopStore((s) => s.toggleLike);
  const toggleSave = useSlopStore((s) => s.toggleSave);
  const addComment = useSlopStore((s) => s.addComment);
  const deleteComment = useSlopStore((s) => s.deleteComment);
  const addReport = useSlopStore((s) => s.addReport);
  const recordView = useSlopStore((s) => s.recordView);
  const drama = dramas.find((d) => d.id === video.dramaId);
  const epLabel = String(video.episodeNumber).padStart(2, "0");
  const epTotal = drama?.episodeCount
    ? String(drama.episodeCount).padStart(2, "0")
    : null;
  const viewed = useRef(false);
  const playbackId = useRef(uid("pb"));
  const lastProgressSent = useRef(0);
  const started = useRef(false);

  const liked = !!user && likes.some((l) => l.userId === user.id && l.videoId === video.id);
  const saved = !!user && saves.some((s) => s.userId === user.id && s.videoId === video.id);
  const videoComments = comments.filter(
    (c) => c.videoId === video.id && c.moderationStatus === "visible",
  );

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = muted;
    if (active && !paused) {
      const play = el.play();
      if (play) play.catch(() => setPaused(true));
      if (!viewed.current) {
        viewed.current = true;
        recordView(video.id);
      }
      if (!started.current) {
        started.current = true;
        void track("video_playback_started", {
          userId: user?.id,
          episodeId: video.id,
          dramaId: video.dramaId,
          playbackSessionId: playbackId.current,
          idempotencyKey: `pbstart:${playbackId.current}`,
          playback: {
            durationMs: (el.duration || video.durationSeconds) * 1000,
            currentMs: el.currentTime * 1000,
            event: "start",
          },
        });
        void track("episode_selected", {
          userId: user?.id,
          episodeId: video.id,
          dramaId: video.dramaId,
        });
      } else if (paused === false) {
        void track("video_resumed", {
          userId: user?.id,
          episodeId: video.id,
          dramaId: video.dramaId,
          playbackSessionId: playbackId.current,
        });
      }
    } else {
      el.pause();
      if (active && paused && started.current) {
        void track("video_paused", {
          userId: user?.id,
          episodeId: video.id,
          dramaId: video.dramaId,
          playbackSessionId: playbackId.current,
          playback: {
            durationMs: (el.duration || video.durationSeconds) * 1000,
            currentMs: el.currentTime * 1000,
            event: "pause",
          },
        });
      }
      if (!active && started.current) {
        const pct = el.duration ? el.currentTime / el.duration : 0;
        void track(pct >= 0.95 ? "video_completed" : "video_abandoned", {
          userId: user?.id,
          episodeId: video.id,
          dramaId: video.dramaId,
          playbackSessionId: playbackId.current,
          playback: {
            durationMs: (el.duration || video.durationSeconds) * 1000,
            currentMs: el.currentTime * 1000,
            event: pct >= 0.95 ? "complete" : "abandon",
          },
        });
        started.current = false;
        playbackId.current = uid("pb");
        lastProgressSent.current = 0;
      }
    }
  }, [active, muted, paused, recordView, video.id, video.dramaId, video.durationSeconds, user?.id]);

  useEffect(() => {
    if (!active) {
      setPaused(false);
      setProgress(0);
    }
  }, [active]);

  const onTimeUpdate = () => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    if (Number.isFinite(el.duration)) setDuration(el.duration);
    if (scrubbing) return;
    const ratio = el.currentTime / el.duration;
    setProgress(ratio);
    const now = Date.now();
    if (now - lastProgressSent.current > 5000) {
      lastProgressSent.current = now;
      void track("video_progress", {
        userId: user?.id,
        episodeId: video.id,
        dramaId: video.dramaId,
        playbackSessionId: playbackId.current,
        properties: {
          pct: Math.round(ratio * 100),
          watchMinutesTotal: Math.floor(el.currentTime / 60),
        },
        playback: {
          durationMs: el.duration * 1000,
          currentMs: el.currentTime * 1000,
          event: "progress",
        },
      });
    }
    if (ratio >= 0.95) {
      void track("video_completed", {
        userId: user?.id,
        episodeId: video.id,
        dramaId: video.dramaId,
        playbackSessionId: playbackId.current,
        idempotencyKey: `pbcomplete:${playbackId.current}`,
        playback: {
          durationMs: el.duration * 1000,
          currentMs: el.currentTime * 1000,
          event: "complete",
        },
      });
    }
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const seekToClientX = useCallback((clientX: number) => {
    const el = videoRef.current;
    const bar = scrubRef.current;
    if (!el || !bar || !el.duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    el.currentTime = ratio * el.duration;
    setProgress(ratio);
  }, []);

  const onScrubPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = videoRef.current;
    wasPlayingBeforeScrub.current = !!el && !el.paused && !paused;
    setScrubbing(true);
    setPaused(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    seekToClientX(e.clientX);
  };

  const onScrubPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrubbing) return;
    e.preventDefault();
    e.stopPropagation();
    seekToClientX(e.clientX);
  };

  const onScrubPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrubbing) return;
    e.preventDefault();
    e.stopPropagation();
    seekToClientX(e.clientX);
    setScrubbing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (wasPlayingBeforeScrub.current) setPaused(false);
  };

  const togglePlay = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const requireAuth = (action: string) => {
    toast.message(`Sign in to ${action}`, {
      description: "Guests can watch and share. Accounts unlock social features.",
      action: {
        label: "Sign in",
        onClick: () => {
          window.location.href = "/auth/sign-in";
        },
      },
    });
  };

  const onLike = () => {
    const res = toggleLike(video.id);
    if (res.needsAuth) requireAuth("like videos");
    else {
      void track("favorite_addition", {
        userId: user?.id,
        episodeId: video.id,
        dramaId: video.dramaId,
      });
    }
  };
  const onSave = () => {
    const res = toggleSave(video.id);
    if (res.needsAuth) requireAuth("save videos");
    else {
      void track("watchlist_addition", {
        userId: user?.id,
        episodeId: video.id,
        dramaId: video.dramaId,
      });
    }
  };
  const onSubmitComment = () => {
    const res = addComment(video.id, commentText);
    if (res.needsAuth) {
      requireAuth("comment");
      return;
    }
    if (!res.ok) {
      toast.error(res.error ?? "Could not post comment");
      return;
    }
    setCommentText("");
    toast.success("Comment posted");
  };

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/v/${video.slug}`
      : `/v/${video.slug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
      void track("share_clicked", {
        userId: user?.id,
        episodeId: video.id,
        dramaId: video.dramaId,
        properties: { method: "copy" },
      });
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <article className="relative h-full w-full snap-start overflow-hidden bg-[var(--slop-black)]">
      {!failed ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={active || loading ? video.videoUrl : undefined}
          poster={video.thumbnailUrl}
          playsInline
          loop
          muted={muted}
          preload={active ? "auto" : "metadata"}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d)) setDuration(d);
          }}
          onWaiting={() => setLoading(true)}
          onPlaying={() => {
            setLoading(false);
            setFailed(false);
          }}
          onLoadedData={() => setLoading(false)}
          onError={() => {
            setFailed(true);
            setLoading(false);
          }}
          onClick={togglePlay}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#121212] px-6 text-center">
          <p className="font-display text-xl text-white">
            Video failed to load
          </p>
          <p className="text-sm text-white/60">
            Check your connection or try the next clip.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setFailed(false);
              setLoading(true);
            }}
          >
            Retry
          </Button>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 slop-player-vignette" />
      <div className="pointer-events-none absolute inset-0 slop-player-grain" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px slop-player-scanline" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[3px] slop-player-rail" />

      {/* Top cinema strip */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-[max(0.85rem,env(safe-area-inset-top))]">
        <div className="mt-11 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="slop-live-pip" aria-hidden />
              <p className="font-display text-[11px] font-bold tracking-[0.32em] text-[var(--slop-lavender)]">
                SLOP
              </p>
            </div>
            <p className="mt-1.5 truncate text-[11px] uppercase tracking-[0.2em] text-white/40">
              {drama?.title ?? video.sourceAttribution}
            </p>
          </div>
          <div className="slop-ep-chip shrink-0 px-3 py-1.5">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Ep
            </p>
            <p className="font-display text-lg font-bold leading-none tabular-nums text-white">
              {epLabel}
              {epTotal ? (
                <span className="text-white/30">/{epTotal}</span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      {loading && active && !failed && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="slop-loader" />
        </div>
      )}

      {paused && active && !scrubbing && (
        <button
          type="button"
          onClick={togglePlay}
          className="slop-pause-mark absolute left-1/2 top-[40%] z-20 flex h-[4.5rem] w-[4.5rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center text-white"
          aria-label="Play"
        >
          <Play className="relative z-10 ml-1 h-7 w-7 fill-[var(--slop-lavender)] text-[var(--slop-lavender)]" />
        </button>
      )}

      {/* Bottom cinema chrome */}
      <div className="absolute inset-x-0 bottom-0 z-30 pb-[max(0.55rem,env(safe-area-inset-bottom))]">
        <div
          key={active ? video.id : "idle"}
          className={`relative px-4 ${active ? "slop-player-meta" : ""}`}
        >
          <div
            aria-hidden
            className="slop-player-ep-ghost absolute -top-14 right-2 text-[8rem] sm:text-[10rem]"
          >
            {epLabel}
          </div>

          <div className="relative flex items-center gap-2">
            <span className="slop-meta-slash" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--slop-violet)]">
              Episode {video.episodeNumber}
              {categoryNames[0] ? ` · ${categoryNames[0]}` : ""}
            </p>
          </div>
          <h2 className="relative mt-2 max-w-[90%] font-display text-[1.7rem] font-bold leading-[0.98] tracking-[-0.03em] text-white sm:text-[2rem]">
            {video.title}
          </h2>
          <p className="relative mt-2.5 max-w-[92%] line-clamp-2 text-[13px] leading-relaxed text-white/65">
            {video.description}
          </p>

          <div className="relative mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="slop-action-dock flex items-center">
              <DockButton
                active={liked}
                onClick={onLike}
                ariaLabel="Like"
                label={video.likeCount > 0 ? formatCount(video.likeCount) : undefined}
              >
                <Heart
                  className={
                    liked
                      ? "fill-[var(--slop-violet)] text-[var(--slop-violet)]"
                      : ""
                  }
                />
              </DockButton>
              <DockButton
                onClick={() => setCommentsOpen(true)}
                ariaLabel="Comments"
                label={
                  video.commentCount > 0
                    ? formatCount(video.commentCount)
                    : undefined
                }
              >
                <MessageCircle />
              </DockButton>
              <DockButton active={saved} onClick={onSave} ariaLabel="Save">
                <Bookmark className={saved ? "fill-white" : ""} />
              </DockButton>
              <DockButton onClick={() => setShareOpen(true)} ariaLabel="Share">
                <Share2 />
              </DockButton>
              <span className="slop-dock-divider" aria-hidden />
              <DockButton
                onClick={onToggleMute}
                ariaLabel={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX /> : <Volume2 />}
              </DockButton>
              <DockButton
                onClick={() => setPaused((p) => !p)}
                ariaLabel={paused ? "Play" : "Pause"}
              >
                {paused ? <Play /> : <Pause />}
              </DockButton>
              <DockButton onClick={() => setReportOpen(true)} ariaLabel="More">
                <MoreHorizontal />
              </DockButton>
            </div>
            {video.viewCount > 0 ? (
              <span className="text-[10px] uppercase tracking-[0.16em] text-white/30">
                {formatCount(video.viewCount)} watched
              </span>
            ) : null}
          </div>
        </div>

        <div className={`mt-4 px-4 ${scrubbing ? "slop-scrubbing" : ""}`}>
          <div className="mb-1.5 flex items-center justify-between font-display text-[10px] font-semibold tabular-nums tracking-wide text-white/45">
            <span className="text-[var(--slop-lavender)]">
              {formatTime(progress * (duration || 0))}
            </span>
            <span className="tracking-[0.28em] text-white/25">SEEK</span>
            <span>{formatTime(duration || video.durationSeconds)}</span>
          </div>
          <div
            ref={scrubRef}
            role="slider"
            aria-label="Seek through episode"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            tabIndex={0}
            className="relative flex h-11 cursor-pointer touch-none items-center"
            onPointerDown={onScrubPointerDown}
            onPointerMove={onScrubPointerMove}
            onPointerUp={onScrubPointerUp}
            onPointerCancel={onScrubPointerUp}
            onKeyDown={(e) => {
              const el = videoRef.current;
              if (!el || !el.duration) return;
              const step = el.duration * 0.05;
              if (e.key === "ArrowRight") {
                el.currentTime = Math.min(el.duration, el.currentTime + step);
                setProgress(el.currentTime / el.duration);
              } else if (e.key === "ArrowLeft") {
                el.currentTime = Math.max(0, el.currentTime - step);
                setProgress(el.currentTime / el.duration);
              }
            }}
          >
            <div
              className={`slop-scrub-track relative w-full ${scrubbing ? "is-scrubbing" : ""}`}
            >
              <div
                className="slop-scrub-fill absolute inset-y-0 left-0"
                style={{ width: `${progress * 100}%` }}
              />
              <div
                className={`slop-scrub-thumb absolute top-1/2 ${scrubbing ? "is-active" : ""}`}
                style={{ left: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={commentsOpen} onClose={() => setCommentsOpen(false)} title="Comments">
        {video.commentsDisabled ? (
          <p className="text-sm text-white/60">Comments are disabled on this video.</p>
        ) : (
          <>
            <div className="mb-4 max-h-64 space-y-3 overflow-y-auto">
              {videoComments.length === 0 && (
                <p className="text-sm text-white/50">No comments yet. Start the chaos.</p>
              )}
              {videoComments.map((c) => (
                <div key={c.id} className="rounded-2xl bg-white/5 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{c.displayName}</p>
                    {(user?.id === c.userId || user?.role === "admin") && (
                      <button
                        type="button"
                        className="text-xs text-white/40 hover:text-red-400"
                        onClick={() => deleteComment(c.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-white/75">{c.text}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={user ? "Add a comment…" : "Sign in to comment"}
                maxLength={500}
              />
              <Button onClick={onSubmitComment}>Post</Button>
            </div>
          </>
        )}
      </Dialog>

      <Dialog open={shareOpen} onClose={() => setShareOpen(false)} title="Share this clip">
        <p className="mb-3 break-all rounded-xl bg-white/5 p-3 text-sm text-white/70">
          {shareUrl}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={copyLink}>Copy link</Button>
          <Link
            href={`/v/${video.slug}`}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/15"
          >
            Open page
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(video.title)}&url=${encodeURIComponent(shareUrl)}`;
              window.open(url, "_blank", "noopener,noreferrer");
            }}
          >
            Share on X
          </Button>
        </div>
      </Dialog>

      <Dialog open={reportOpen} onClose={() => setReportOpen(false)} title="Report content">
        <div className="space-y-3">
          <label className="block text-xs uppercase tracking-wide text-white/50">
            Reason
            <select
              className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            >
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="copyright">Copyright</option>
              <option value="misleading">Misleading</option>
              <option value="other">Other</option>
            </select>
          </label>
          <Textarea
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            placeholder="Optional details"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => {
                const res = addReport({
                  contentType: "video",
                  contentId: video.id,
                  reason: reportReason,
                  details: reportDetails,
                });
                if (res.needsAuth) {
                  requireAuth("report content");
                  return;
                }
                toast.success("Report submitted");
                setReportOpen(false);
                setReportDetails("");
              }}
            >
              <Flag className="h-4 w-4" /> Submit report
            </Button>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </article>
  );
}

function DockButton({
  children,
  label,
  onClick,
  active,
  ariaLabel,
}: {
  children: React.ReactNode;
  label?: string;
  onClick: () => void;
  active?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`slop-dock-btn group relative flex h-11 min-w-11 items-center justify-center gap-1.5 px-2.5 text-white/85 transition ${
        active ? "is-active text-[var(--slop-lavender)]" : "hover:text-white"
      }`}
    >
      <span className="[&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:stroke-[1.75]">
        {children}
      </span>
      {label ? (
        <span className="font-display text-[10px] font-semibold tabular-nums tracking-wide text-white/55 group-hover:text-white/80">
          {label}
        </span>
      ) : null}
    </button>
  );
}
