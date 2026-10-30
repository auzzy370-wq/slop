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
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");

  const user = useSlopStore((s) => s.currentUser);
  const likes = useSlopStore((s) => s.likes);
  const saves = useSlopStore((s) => s.saves);
  const comments = useSlopStore((s) => s.comments);
  const toggleLike = useSlopStore((s) => s.toggleLike);
  const toggleSave = useSlopStore((s) => s.toggleSave);
  const addComment = useSlopStore((s) => s.addComment);
  const deleteComment = useSlopStore((s) => s.deleteComment);
  const addReport = useSlopStore((s) => s.addReport);
  const recordView = useSlopStore((s) => s.recordView);
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

  const seekFromPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * el.duration;
    setProgress(ratio);
  };

  return (
    <article className="relative h-full w-full snap-start overflow-hidden bg-black">
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

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/75" />

      {loading && active && !failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--slop-violet)]" />
        </div>
      )}

      {paused && active && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/50 p-4 text-white backdrop-blur-md"
          aria-label="Play"
        >
          <Play className="h-8 w-8 fill-white" />
        </button>
      )}

      <div className="absolute bottom-24 left-0 right-16 z-20 px-4 sm:bottom-28">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--slop-violet)]">
          {video.sourceAttribution} · EP {video.episodeNumber}
        </p>
        <h2 className="font-display text-xl leading-tight text-white drop-shadow-md sm:text-2xl">
          {video.title}
        </h2>
        <p className="mt-2 line-clamp-2 text-sm text-white/80">{video.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {categoryNames.map((name) => (
            <span
              key={name}
              className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur"
            >
              {name}
            </span>
          ))}
        </div>
        {video.viewCount > 0 ? (
          <p className="mt-2 text-xs text-white/50">
            {formatCount(video.viewCount)} views
          </p>
        ) : null}
      </div>

      <div className="absolute bottom-28 right-3 z-20 flex flex-col items-center gap-4 sm:bottom-32">
        <ActionButton
          label={video.likeCount > 0 ? formatCount(video.likeCount) : "Like"}
          active={liked}
          onClick={onLike}
          ariaLabel="Like"
        >
          <Heart className={liked ? "fill-[var(--slop-violet)] text-[var(--slop-violet)]" : ""} />
        </ActionButton>
        <ActionButton
          label={
            video.commentCount > 0 ? formatCount(video.commentCount) : "Comment"
          }
          onClick={() => setCommentsOpen(true)}
          ariaLabel="Comments"
        >
          <MessageCircle />
        </ActionButton>
        <ActionButton
          label={
            saved
              ? "Saved"
              : video.saveCount > 0
                ? formatCount(video.saveCount)
                : "Save"
          }
          active={saved}
          onClick={onSave}
          ariaLabel="Save"
        >
          <Bookmark className={saved ? "fill-white" : ""} />
        </ActionButton>
        <ActionButton label="Share" onClick={() => setShareOpen(true)} ariaLabel="Share">
          <Share2 />
        </ActionButton>
        <ActionButton
          label=""
          onClick={onToggleMute}
          ariaLabel={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX /> : <Volume2 />}
        </ActionButton>
        <ActionButton
          label=""
          onClick={() => setPaused((p) => !p)}
          ariaLabel={paused ? "Play" : "Pause"}
        >
          {paused ? <Play /> : <Pause />}
        </ActionButton>
        <ActionButton label="" onClick={() => setReportOpen(true)} ariaLabel="More">
          <MoreHorizontal />
        </ActionButton>
      </div>

      <div
        className="absolute bottom-[5.5rem] left-0 right-0 z-30 px-3 sm:bottom-24"
        onPointerDown={seekFromPointer}
      >
        <div className="h-1 overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-[var(--slop-violet)] transition-[width] duration-100"
            style={{ width: `${progress * 100}%` }}
          />
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

function ActionButton({
  children,
  label,
  onClick,
  active,
  ariaLabel,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex flex-col items-center gap-1 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] transition hover:scale-105"
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-md ${active ? "ring-1 ring-[var(--slop-violet)]/50" : ""}`}
      >
        <span className="[&>svg]:h-6 [&>svg]:w-6">{children}</span>
      </span>
      {label ? <span className="text-[11px] font-medium">{label}</span> : null}
    </button>
  );
}
