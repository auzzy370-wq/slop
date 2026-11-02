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
  Clapperboard,
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
import {
  EpisodeSheet,
  formatSpeed,
  loadPlaybackSpeed,
  nextPlaybackSpeed,
  savePlaybackSpeed,
} from "@/components/feed/episode-sheet";
import { ScriptedPlayer } from "@/components/feed/scripted-player";
import Link from "next/link";
import { track } from "@/lib/analytics/client";
import { resolveSocialActor } from "@/lib/social/guest";
import {
  syncAddComment,
  syncToggleLike,
} from "@/lib/social/engagement-client";
import { requestEngagementRefresh } from "@/components/social-hydrator";
import { getOriginalScript } from "@/lib/series/originals/catalog";
import { isVercelBlobUrl, resolvePlaybackUrl } from "@/lib/media-url";

interface VideoCardProps {
  video: Video;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  /** Desktop autoplay policy — force mute without toggling. */
  onAutoplayBlocked?: () => void;
  categoryNames: string[];
  onJumpToVideo?: (videoId: string) => void;
  onEpisodeEnded?: () => void;
  onPlaybackFailed?: () => void;
}

export function VideoCard({
  video,
  active,
  muted,
  onToggleMute,
  onAutoplayBlocked,
  categoryNames,
  onJumpToVideo,
  onEpisodeEnded,
  onPlaybackFailed,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isScripted = video.playback === "scripted";
  const script = (() => {
    if (!isScripted || !video.scriptSeriesId) return undefined;
    return getOriginalScript(video.scriptSeriesId, video.episodeNumber);
  })();
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(false);
  /** Actual element playing state — PC can load a frame while stay paused. */
  const [isPlaying, setIsPlaying] = useState(false);
  const blobPlaybackBlocked = useSlopStore((s) => s.blobPlaybackBlocked);
  const storageBlocked =
    isVercelBlobUrl(video.videoUrl) && blobPlaybackBlocked;
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(!isScripted);
  /** Bumps to force a clean <video> remount after abort / retry. */
  const [mediaKey, setMediaKey] = useState(0);
  const retryCount = useRef(0);
  const notifiedFail = useRef(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [episodesOpen, setEpisodesOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
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
  const allVideos = useSlopStore((s) => s.videos);
  const toggleLike = useSlopStore((s) => s.toggleLike);
  const toggleSave = useSlopStore((s) => s.toggleSave);
  const addComment = useSlopStore((s) => s.addComment);
  const deleteComment = useSlopStore((s) => s.deleteComment);
  const mergeSharedEngagement = useSlopStore((s) => s.mergeSharedEngagement);
  const addReport = useSlopStore((s) => s.addReport);
  const recordView = useSlopStore((s) => s.recordView);
  const [actorId, setActorId] = useState<string | null>(user?.id ?? null);
  useEffect(() => {
    setActorId(resolveSocialActor(user).id);
  }, [user]);
  const drama = dramas.find((d) => d.id === video.dramaId);
  const seriesEpisodes = allVideos
    .filter((v) => v.dramaId === video.dramaId && v.status === "published")
    .sort((a, b) => a.episodeNumber - b.episodeNumber);
  const epLabel = String(video.episodeNumber).padStart(2, "0");
  const epTotalCount =
    drama?.episodeCount && drama.episodeCount > seriesEpisodes.length
      ? drama.episodeCount
      : seriesEpisodes.length || video.episodeNumber;
  const epTotal = String(epTotalCount).padStart(2, "0");
  const viewed = useRef(false);
  const playbackId = useRef(uid("pb"));
  const lastProgressSent = useRef(0);
  const started = useRef(false);
  const endedOnce = useRef(false);

  const liked =
    !!actorId &&
    likes.some((l) => l.userId === actorId && l.videoId === video.id);
  const saved = !!user && saves.some((s) => s.userId === user.id && s.videoId === video.id);
  const videoComments = comments.filter(
    (c) => c.videoId === video.id && c.moderationStatus === "visible",
  );

  useEffect(() => {
    if (!active) {
      notifiedFail.current = false;
      return;
    }
    if (storageBlocked) {
      setFailed(true);
      setLoading(false);
      if (!notifiedFail.current) {
        notifiedFail.current = true;
        onPlaybackFailed?.();
      }
    }
  }, [active, storageBlocked, onPlaybackFailed, video.id]);

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

    // Video node only exists while this card is active (Safari single-decoder).
    if (!active) {
      if (started.current) {
        void track("video_abandoned", {
          userId: user?.id,
          episodeId: video.id,
          dramaId: video.dramaId,
          playbackSessionId: playbackId.current,
          playback: {
            durationMs: video.durationSeconds * 1000,
            currentMs: progress * video.durationSeconds * 1000,
            event: "abandon",
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

    if (paused) {
      el.pause();
      setIsPlaying(false);
      if (started.current) {
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
      return;
    }

    let cancelled = false;
    const kickPlay = () => {
      const node = videoRef.current;
      if (!node || cancelled) return;
      // Already rolling — don't remute / restart (would fight the unmute button).
      if (!node.paused && !node.ended) {
        setIsPlaying(true);
        setLoading(false);
        return;
      }
      // First start: force muted so desktop autoplay is allowed.
      if (!muted) onAutoplayBlocked?.();
      node.muted = true;
      void node
        .play()
        .then(() => {
          if (cancelled) return;
          setIsPlaying(true);
          setLoading(false);
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
                durationMs: (node.duration || video.durationSeconds) * 1000,
                currentMs: node.currentTime * 1000,
                event: "start",
              },
            });
            void track("episode_selected", {
              userId: user?.id,
              episodeId: video.id,
              dramaId: video.dramaId,
            });
          }
        })
        .catch(() => {
          if (cancelled) return;
          // Show the big play button — loaded frame with no playback.
          setIsPlaying(false);
          setPaused(true);
          setLoading(false);
        });
    };

    if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      kickPlay();
    } else {
      el.addEventListener("canplay", kickPlay);
      el.addEventListener("loadeddata", kickPlay);
    }

    return () => {
      cancelled = true;
      el.removeEventListener("canplay", kickPlay);
      el.removeEventListener("loadeddata", kickPlay);
    };
  }, [
    active,
    paused,
    recordView,
    video.id,
    video.dramaId,
    video.durationSeconds,
    user?.id,
    isScripted,
    mediaKey,
    muted,
    onAutoplayBlocked,
  ]);

  // Keep mute attribute in sync without restarting playback.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !active) return;
    el.muted = muted;
  }, [muted, active, mediaKey]);

  useEffect(() => {
    if (!active) {
      setPaused(false);
      setProgress(0);
      setChromeVisible(true);
      setFailed(false);
      setLoading(false);
      retryCount.current = 0;
      endedOnce.current = false;
      return;
    }
    // Episode picks / feed advances should always start playing.
    setPaused(false);
    setIsPlaying(false);
    setFailed(false);
    setLoading(!isScripted);
    retryCount.current = 0;
    endedOnce.current = false;
    setSpeed(loadPlaybackSpeed());
  }, [active, isScripted, video.id]);

  const handleEpisodeEnded = useCallback(() => {
    if (!active || endedOnce.current) return;
    endedOnce.current = true;
    onEpisodeEnded?.();
  }, [active, onEpisodeEnded]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.playbackRate = speed;
  }, [speed, active, mediaKey]);

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
    if (
      paused ||
      scrubbing ||
      commentsOpen ||
      shareOpen ||
      reportOpen ||
      episodesOpen
    ) {
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
    episodesOpen,
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
    const el = videoRef.current;
    setPaused((p) => {
      if (p) {
        // Resume inside the click handler so PC browsers treat it as a user gesture.
        if (el) {
          el.muted = muted;
          void el.play().catch(() => {
            el.muted = true;
            onAutoplayBlocked?.();
            void el.play().catch(() => {});
          });
        }
        return false;
      }
      el?.pause();
      return true;
    });
  }, [scheduleChromeHide, muted, onAutoplayBlocked]);

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
      description: "Likes, comments, and shares work without an account. Saves need a sign-in.",
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
    const actor = resolveSocialActor(user);
    const res = toggleLike(video.id, { id: actor.id });
    if (!res.ok) {
      toast.error("Could not like");
      return;
    }
    void track("favorite_addition", {
      userId: user?.id ?? actor.id,
      episodeId: video.id,
      dramaId: video.dramaId,
    });
    void syncToggleLike({ videoId: video.id, user }).then((remote) => {
      if (remote.ok && remote.likes) {
        mergeSharedEngagement({
          likes: remote.likes,
          comments: useSlopStore.getState().comments,
        });
      }
      requestEngagementRefresh();
    });
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
    const postedText = commentText.trim();
    if (!postedText) return;
    const actor = resolveSocialActor(user);
    setCommentText("");

    // Server-first so every device sees the same thread. Fall back to local
    // only if the network write fails.
    void (async () => {
      const remote = await syncAddComment({
        videoId: video.id,
        text: postedText,
        user,
        parentId: opts?.parentId,
        replyToName: opts?.replyToName,
      });
      if (remote.ok && remote.comments) {
        mergeSharedEngagement({
          likes: useSlopStore.getState().likes,
          comments: remote.comments,
        });
        toast.success(opts?.parentId ? "Reply posted" : "Comment posted");
        requestEngagementRefresh();
        return;
      }

      const local = addComment(video.id, postedText, {
        ...opts,
        actor: {
          id: actor.id,
          displayName: actor.displayName,
          avatarUrl: actor.avatarUrl,
        },
      });
      if (!local.ok) {
        setCommentText(postedText);
        toast.error(remote.error ?? local.error ?? "Could not post comment");
        return;
      }
      toast.message(opts?.parentId ? "Reply saved on this device" : "Comment saved on this device", {
        description: "Couldn’t reach the shared feed — others may not see it yet.",
      });
    })();
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
          onEnded={handleEpisodeEnded}
        />
      ) : active && !failed && !storageBlocked ? (
        <video
          key={`${video.id}-${mediaKey}`}
          ref={videoRef}
          className="slop-feed-video"
          src={resolvePlaybackUrl(video.videoUrl)}
          poster={video.thumbnailUrl}
          playsInline
          // Desktop autoplay requires muted; keep attribute in sync with state.
          muted={muted}
          autoPlay={active && !paused}
          preload="auto"
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d)) setDuration(d);
          }}
          onWaiting={() => setLoading(true)}
          onPlaying={() => {
            setIsPlaying(true);
            setPaused(false);
            setLoading(false);
            setFailed(false);
            retryCount.current = 0;
          }}
          onPause={() => {
            setIsPlaying(false);
          }}
          onLoadedData={() => {
            setLoading(false);
            if (!paused) {
              const node = videoRef.current;
              if (!node) return;
              // Always kick muted first — desktop autoplay requires it.
              node.muted = true;
              void node.play().catch(() => {
                onAutoplayBlocked?.();
                setIsPlaying(false);
                setPaused(true);
              });
            }
          }}
          onCanPlay={() => {
            if (!paused) {
              const node = videoRef.current;
              if (!node) return;
              if (!node.paused && !node.ended) {
                setIsPlaying(true);
                return;
              }
              node.muted = true;
              void node.play().catch(() => {
                onAutoplayBlocked?.();
                setIsPlaying(false);
                setPaused(true);
              });
            }
          }}
          onEnded={handleEpisodeEnded}
          onError={(e) => {
            const mediaErr = e.currentTarget.error;
            // Remounts / source swaps abort the previous element — not a real failure.
            if (
              !e.currentTarget.currentSrc ||
              mediaErr?.code === MediaError.MEDIA_ERR_ABORTED
            ) {
              return;
            }
            // Auto-recover on Safari transient decode / network errors.
            if (!storageBlocked && retryCount.current < 2) {
              retryCount.current += 1;
              setLoading(true);
              window.setTimeout(() => setMediaKey((k) => k + 1), 220);
              return;
            }
            setFailed(true);
            setLoading(false);
            setIsPlaying(false);
            setPaused(true);
            // Don't auto-skip the whole series on a single PC load glitch —
            // only Blob-blocked episodes should advance the feed.
            if (storageBlocked && !notifiedFail.current) {
              notifiedFail.current = true;
              onPlaybackFailed?.();
            }
          }}
          onClick={onVideoSurfaceTap}
        />
      ) : failed && active ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#121212] px-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={video.thumbnailUrl}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
          />
          <p className="relative font-display text-xl text-white">
            {storageBlocked || isVercelBlobUrl(video.videoUrl)
              ? "Cloud storage blocked"
              : "Video failed to load"}
          </p>
          <p className="relative max-w-sm text-sm text-white/60">
            {storageBlocked || isVercelBlobUrl(video.videoUrl)
              ? "This episode is on a suspended Vercel Blob store. Unsuspend Blob in Vercel, or re-upload the originals to Cloudflare R2 — no need to rebuild the catalog."
              : "Safari sometimes drops the stream — tap retry."}
          </p>
          {!storageBlocked && (
            <Button
              variant="secondary"
              className="relative"
              onClick={() => {
                retryCount.current = 0;
                notifiedFail.current = false;
                setFailed(false);
                setLoading(true);
                setMediaKey((k) => k + 1);
              }}
            >
              Retry
            </Button>
          )}
        </div>
      ) : (
        // Inactive neighbor — poster only. Keeps Safari from fighting over decoders.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={video.thumbnailUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
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

      {active && !scrubbing && !loading && !failed && !isPlaying && (
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
        className={`slop-action-rail absolute right-2.5 z-30 flex flex-col items-center gap-3.5 transition-[bottom] duration-300 ease-out sm:right-3.5 sm:gap-4 ${
          chromeVisible ? "bottom-[5.75rem]" : "bottom-[3.75rem]"
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
            requestEngagementRefresh();
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

      {/* Bottom caption + film scrub — flush to the home indicator */}
      <div className="absolute inset-x-0 bottom-0 z-30 pb-[max(0.15rem,env(safe-area-inset-bottom,0px))]">
        <div
          key={active ? video.id : "idle"}
          className={`slop-caption relative px-3 pr-[4.75rem] sm:px-4 sm:pr-24 ${
            chromeVisible ? "is-visible" : "is-hidden"
          }`}
          aria-hidden={!chromeVisible}
        >
          <div
            aria-hidden
            className="slop-player-ep-ghost pointer-events-none absolute -top-8 left-0 text-[4.5rem] opacity-80 sm:text-[6rem]"
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
          <h2 className="relative mt-1 max-w-[100%] font-display text-[1.25rem] font-bold leading-[1.05] tracking-tight text-white sm:text-[1.5rem]">
            {video.title}
          </h2>
          <p className="relative mt-1 line-clamp-2 text-[12px] leading-snug text-white/70">
            {video.description}
          </p>
        </div>

        <div className={`mt-1 px-3 sm:px-4 ${scrubbing ? "slop-scrubbing" : ""}`}>
          <div className="mb-0.5 flex items-center justify-between font-display text-[10px] font-semibold tabular-nums tracking-wide text-white/45">
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
            className="relative flex h-5 cursor-pointer touch-none items-center"
            data-no-swipe
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

          {/* Episode picker + speed — flush to bottom */}
          <div
            className="mt-1 flex items-center gap-2"
            data-no-swipe
          >
            <button
              type="button"
              onClick={() => {
                revealChrome();
                setEpisodesOpen(true);
              }}
              className="inline-flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/60"
              aria-label="Choose episode"
            >
              <Clapperboard className="h-3.5 w-3.5 shrink-0 text-[var(--slop-violet)]" />
              <span className="truncate">
                Episode {video.episodeNumber}/{epTotalCount}
              </span>
              <span className="ml-auto text-white/45" aria-hidden>
                ˄
              </span>
            </button>
            {!isScripted ? (
              <button
                type="button"
                onClick={() => {
                  revealChrome();
                  const next = nextPlaybackSpeed(speed);
                  setSpeed(next);
                  savePlaybackSpeed(next);
                  if (videoRef.current) videoRef.current.playbackRate = next;
                  toast.message(`Speed ${formatSpeed(next)}`, {
                    duration: 1200,
                  });
                }}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/45 px-3 text-xs font-bold tabular-nums text-white backdrop-blur-md transition hover:bg-black/60"
                aria-label={`Playback speed ${formatSpeed(speed)}. Tap to change.`}
              >
                {formatSpeed(speed)}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <EpisodeSheet
        open={episodesOpen}
        onClose={() => setEpisodesOpen(false)}
        title={drama?.title ?? video.sourceAttribution}
        episodes={seriesEpisodes}
        currentId={video.id}
        onSelect={(id) => {
          if (id === video.id) return;
          onJumpToVideo?.(id);
        }}
      />

      <CommentsSheet
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        comments={videoComments}
        commentsDisabled={!!video.commentsDisabled}
        commentText={commentText}
        onCommentTextChange={setCommentText}
        onSubmit={onSubmitComment}
        canComment
        currentUserId={actorId ?? undefined}
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
