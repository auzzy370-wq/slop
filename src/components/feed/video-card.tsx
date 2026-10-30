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
  Play,
  Share2,
  Volume2,
  VolumeX,
  Flag,
} from "lucide-react";
import { SlopMarkMini } from "@/components/brand/logo";
import { toast } from "sonner";
import type { Video } from "@/lib/types";
import { formatCount, uid } from "@/lib/utils";
import { useSlopStore } from "@/store/slop-store";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CommentsSheet } from "@/components/feed/comments-sheet";
import { ScriptedPlayer } from "@/components/feed/scripted-player";
import Link from "next/link";
import { track } from "@/lib/analytics/client";
import { getForgottenWifeScript } from "@/lib/series/forgotten-wife/scripts";
import { getOriginalScript } from "@/lib/series/originals/catalog";

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
  const isScripted = video.playback === "scripted";
  const script = (() => {
    if (!isScripted || !video.scriptSeriesId) return undefined;
    if (video.scriptSeriesId === "forgotten-wife") {
      return getForgottenWifeScript(video.episodeNumber);
    }
    return getOriginalScript(video.scriptSeriesId, video.episodeNumber);
  })();
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(!isScripted);
  const [scrubbing, setScrubbing] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");
  const scrubRef = useRef<HTMLDivElement>(null);
  const wasPlayingBeforeScrub = useRef(false);
  const chromeHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (isScripted) {
      if (active && !paused) {
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
              durationMs: video.durationSeconds * 1000,
              currentMs: progress * video.durationSeconds * 1000,
              event: "start",
            },
          });
          void track("episode_selected", {
            userId: user?.id,
            episodeId: video.id,
            dramaId: video.dramaId,
          });
        }
      } else if (!active && started.current) {
        const pct = progress;
        void track(pct >= 0.95 ? "video_completed" : "video_abandoned", {
          userId: user?.id,
          episodeId: video.id,
          dramaId: video.dramaId,
          playbackSessionId: playbackId.current,
          playback: {
            durationMs: video.durationSeconds * 1000,
            currentMs: progress * video.durationSeconds * 1000,
            event: pct >= 0.95 ? "complete" : "abandon",
          },
        });
        started.current = false;
        playbackId.current = uid("pb");
        lastProgressSent.current = 0;
      }
      return;
    }

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
  }, [active, muted, paused, recordView, video.id, video.dramaId, video.durationSeconds, user?.id, isScripted, progress]);

  useEffect(() => {
    if (!active) {
      setPaused(false);
      setProgress(0);
      setChromeVisible(true);
    }
  }, [active]);

  const clearChromeHideTimer = useCallback(() => {
    if (chromeHideTimer.current) {
      clearTimeout(chromeHideTimer.current);
      chromeHideTimer.current = null;
    }
  }, []);

  const scheduleChromeHide = useCallback(() => {
    clearChromeHideTimer();
    if (!active) return;
    chromeHideTimer.current = setTimeout(() => {
      setChromeVisible(false);
      chromeHideTimer.current = null;
    }, 10000);
  }, [active, clearChromeHideTimer]);

  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    scheduleChromeHide();
  }, [scheduleChromeHide]);

  useEffect(() => {
    if (!active) {
      clearChromeHideTimer();
      return;
    }
    setChromeVisible(true);
    scheduleChromeHide();
    return clearChromeHideTimer;
  }, [active, video.id, clearChromeHideTimer, scheduleChromeHide]);

  useEffect(() => {
    if (!active) return;
    if (paused || scrubbing || commentsOpen || shareOpen || reportOpen) {
      clearChromeHideTimer();
      setChromeVisible(true);
      return;
    }
    scheduleChromeHide();
  }, [
    active,
    paused,
    scrubbing,
    commentsOpen,
    shareOpen,
    reportOpen,
    clearChromeHideTimer,
    scheduleChromeHide,
  ]);

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

  const seekToClientX = useCallback(
    (clientX: number) => {
      const bar = scrubRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      if (isScripted) {
        setProgress(ratio);
        return;
      }
      const el = videoRef.current;
      if (!el || !el.duration) return;
      el.currentTime = ratio * el.duration;
      setProgress(ratio);
    },
    [isScripted],
  );

  const onScrubPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = videoRef.current;
    wasPlayingBeforeScrub.current = isScripted
      ? !paused
      : !!el && !el.paused && !paused;
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
    setChromeVisible(true);
    scheduleChromeHide();
    setPaused((p) => !p);
  }, [scheduleChromeHide]);

  const onVideoSurfaceTap = useCallback(() => {
    if (!chromeVisible) {
      revealChrome();
      return;
    }
    togglePlay();
  }, [chromeVisible, revealChrome, togglePlay]);

  const requireAuth = (action: string) => {
    // Bottom placement — clear of Dynamic Island / status bar and in thumb reach.
    toast.message(`Sign in to ${action}`, {
      description: "Guests can watch and share. Accounts unlock social features.",
      position: "bottom-center",
      duration: 6000,
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
  const onSubmitComment = (opts?: {
    parentId?: string;
    replyToName?: string;
  }) => {
    const res = addComment(video.id, commentText, opts);
    if (res.needsAuth) {
      requireAuth("comment");
      return;
    }
    if (!res.ok) {
      toast.error(res.error ?? "Could not post comment");
      return;
    }
    setCommentText("");
    toast.success(opts?.parentId ? "Reply posted" : "Comment posted");
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
    <article className="relative h-full w-full overflow-hidden bg-[var(--slop-black)]">
      {script ? (
        <ScriptedPlayer
          script={script}
          seriesTitle={drama?.title ?? "SLOP Original"}
          active={active}
          paused={paused || scrubbing}
          progress={progress}
          onProgress={(ratio) => {
            if (scrubbing) return;
            setProgress(ratio);
            const now = Date.now();
            if (now - lastProgressSent.current > 5000) {
              lastProgressSent.current = now;
              void track("video_progress", {
                userId: user?.id,
                episodeId: video.id,
                dramaId: video.dramaId,
                playbackSessionId: playbackId.current,
                properties: { pct: Math.round(ratio * 100) },
                playback: {
                  durationMs: video.durationSeconds * 1000,
                  currentMs: ratio * video.durationSeconds * 1000,
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
                  durationMs: video.durationSeconds * 1000,
                  currentMs: ratio * video.durationSeconds * 1000,
                  event: "complete",
                },
              });
            }
          }}
          onDuration={(sec) => setDuration(sec)}
          onTap={onVideoSurfaceTap}
        />
      ) : !failed ? (
        <video
          ref={videoRef}
          className="slop-feed-video"
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
          onClick={onVideoSurfaceTap}
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

      {/* Top strip — brand + episode chip */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mt-11 min-w-0">
          <div className="flex items-center gap-1.5">
            <SlopMarkMini className="h-3.5 w-3.5" />
            <p className="font-display text-[11px] font-bold tracking-[0.22em] text-white/90">
              SLOP
            </p>
          </div>
          <p className="mt-1 truncate text-[11px] uppercase tracking-[0.18em] text-white/40">
            {drama?.title ?? video.sourceAttribution}
          </p>
        </div>
        <div className="slop-ep-chip mt-11 shrink-0 px-2.5 py-1.5">
          <p className="font-display text-sm font-bold tabular-nums leading-none text-white">
            {epLabel}
            {epTotal ? <span className="text-white/30">/{epTotal}</span> : null}
          </p>
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
          className="slop-pause-ring absolute left-1/2 top-[42%] z-20 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-md"
          aria-label="Play"
        >
          <Play className="ml-0.5 h-7 w-7 fill-white text-white" />
        </button>
      )}

      {/* Instagram Reels–style right action rail */}
      <div
        className={`slop-action-rail absolute right-2.5 z-30 flex flex-col items-center gap-5 transition-[bottom] duration-300 ease-out sm:right-3.5 sm:gap-6 ${
          chromeVisible ? "bottom-[7.5rem]" : "bottom-[3.75rem]"
        }`}
      >
        <RailButton
          active={liked}
          onClick={() => {
            revealChrome();
            onLike();
          }}
          ariaLabel="Like"
          label={formatCount(video.likeCount)}
        >
          <Heart
            className={
              liked ? "fill-[#ff3040] text-[#ff3040]" : "fill-transparent"
            }
          />
        </RailButton>
        <RailButton
          onClick={() => {
            revealChrome();
            setCommentsOpen(true);
          }}
          ariaLabel="Comments"
          label={formatCount(video.commentCount)}
        >
          <MessageCircle className="fill-transparent" />
        </RailButton>
        <RailButton
          active={saved}
          onClick={() => {
            revealChrome();
            onSave();
          }}
          ariaLabel="Save"
        >
          <Bookmark
            className={saved ? "fill-white text-white" : "fill-transparent"}
          />
        </RailButton>
        <RailButton
          onClick={() => {
            revealChrome();
            setShareOpen(true);
          }}
          ariaLabel="Share"
        >
          <Share2 className="fill-transparent" />
        </RailButton>
        {!isScripted ? (
          <RailButton
            onClick={() => {
              revealChrome();
              onToggleMute();
            }}
            ariaLabel={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <VolumeX className="fill-transparent" />
            ) : (
              <Volume2 className="fill-transparent" />
            )}
          </RailButton>
        ) : null}
        <RailButton
          onClick={() => {
            revealChrome();
            setReportOpen(true);
          }}
          ariaLabel="More"
        >
          <MoreHorizontal />
        </RailButton>
      </div>

      {/* Bottom caption + film scrub — leaves room for the rail */}
      <div className="absolute inset-x-0 bottom-0 z-30 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        <div
          key={active ? video.id : "idle"}
          className={`slop-caption relative px-3 pr-[4.75rem] sm:px-4 sm:pr-24 ${
            chromeVisible ? "is-visible" : "is-hidden"
          }`}
          aria-hidden={!chromeVisible}
        >
          <div
            aria-hidden
            className="slop-player-ep-ghost pointer-events-none absolute -top-10 left-0 text-[5.5rem] opacity-80 sm:text-[7rem]"
          >
            {epLabel}
          </div>

          <div className="relative flex items-center gap-2">
            <span className="slop-meta-slash" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--slop-violet)]">
              Ep {video.episodeNumber}
              {categoryNames[0] ? ` · ${categoryNames[0]}` : ""}
            </p>
            {video.viewCount > 0 ? (
              <span className="text-[10px] uppercase tracking-[0.14em] text-white/30">
                · {formatCount(video.viewCount)} watched
              </span>
            ) : null}
          </div>
          <h2 className="relative mt-1.5 max-w-[100%] font-display text-[1.45rem] font-bold leading-[1.05] tracking-tight text-white sm:text-[1.75rem]">
            {video.title}
          </h2>
          <p className="relative mt-1.5 line-clamp-2 text-[13px] leading-snug text-white/70">
            {video.description}
          </p>
        </div>

        <div className={`mt-3 px-3 sm:px-4 ${scrubbing ? "slop-scrubbing" : ""}`}>
          <div className="mb-1 flex items-center justify-between font-display text-[10px] font-semibold tabular-nums tracking-wide text-white/45">
            <span className="text-[var(--slop-lavender)]">
              {formatTime(progress * (duration || 0))}
            </span>
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
            className="relative flex h-9 cursor-pointer touch-none items-center"
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

      <CommentsSheet
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        comments={videoComments}
        commentsDisabled={!!video.commentsDisabled}
        commentText={commentText}
        onCommentTextChange={setCommentText}
        onSubmit={onSubmitComment}
        canComment={!!user}
        currentUserId={user?.id}
        isAdmin={user?.role === "admin"}
        onDelete={deleteComment}
      />

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

function RailButton({
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
      className="slop-rail-btn group flex flex-col items-center gap-1 text-white"
    >
      <span
        className={`slop-rail-orb flex h-11 w-11 items-center justify-center ${
          active ? "is-active" : ""
        }`}
      >
        <span className="[&>svg]:h-[28px] [&>svg]:w-[28px] [&>svg]:stroke-[1.75]">
          {children}
        </span>
      </span>
      {label != null && label !== "" ? (
        <span className="slop-rail-label text-center text-[12px] font-semibold leading-none tabular-nums">
          {label}
        </span>
      ) : null}
    </button>
  );
}
