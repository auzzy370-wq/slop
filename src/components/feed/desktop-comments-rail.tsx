"use client";

import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { formatCount } from "@/lib/utils";
import { useSlopStore } from "@/store/slop-store";
import { resolveSocialActor } from "@/lib/social/guest";
import { syncAddComment } from "@/lib/social/engagement-client";
import { requestEngagementRefresh } from "@/components/social-hydrator";

/** Always-visible comments column for the desktop watch layout. */
export function DesktopCommentsRail({
  videoId,
  commentsDisabled,
}: {
  videoId?: string;
  commentsDisabled?: boolean;
}) {
  const user = useSlopStore((s) => s.currentUser);
  const comments = useSlopStore((s) => s.comments);
  const addComment = useSlopStore((s) => s.addComment);
  const mergeSharedEngagement = useSlopStore((s) => s.mergeSharedEngagement);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const thread = useMemo(() => {
    if (!videoId) return [];
    return comments
      .filter((c) => c.videoId === videoId && !c.parentId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [comments, videoId]);

  const post = async () => {
    const posted = text.trim();
    if (!posted || !videoId || sending) return;
    const actor = resolveSocialActor(user);
    setText("");
    setSending(true);
    try {
      const remote = await syncAddComment({
        videoId,
        text: posted,
        user,
      });
      if (remote.ok && remote.comments) {
        mergeSharedEngagement({
          likes: useSlopStore.getState().likes,
          comments: remote.comments,
        });
        requestEngagementRefresh();
        return;
      }
      const local = addComment(videoId, posted, {
        actor: {
          id: actor.id,
          displayName: actor.displayName,
          avatarUrl: actor.avatarUrl,
        },
      });
      if (!local.ok) {
        setText(posted);
        toast.error(remote.error ?? local.error ?? "Could not post");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--slop-panel)]/55 backdrop-blur-xl">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          Comments
        </p>
        <p className="text-[11px] tabular-nums text-white/35">
          {formatCount(thread.length)}
        </p>
      </div>

      <div
        className="scrollbar-none min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
        data-no-swipe
        data-sheet-scroll
        onWheel={(e) => e.stopPropagation()}
      >
        {!videoId ? (
          <p className="px-2 py-10 text-center text-sm text-white/40">
            Pick an episode to join the chat.
          </p>
        ) : commentsDisabled ? (
          <p className="px-2 py-10 text-center text-sm text-white/45">
            Comments are turned off for this episode.
          </p>
        ) : thread.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <p className="text-sm font-semibold text-white/80">
              Be the first to comment
            </p>
            <p className="text-xs text-white/40">
              Say what just happened — keep it short.
            </p>
          </div>
        ) : (
          <ul className="space-y-3 pb-2">
            {thread.map((c) => {
              const initial = (c.displayName || "?").slice(0, 1).toUpperCase();
              return (
                <li key={c.id} className="flex gap-2.5">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--slop-violet)]/25 text-[11px] font-bold text-[var(--slop-lavender)]"
                    aria-hidden
                  >
                    {c.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initial
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-white/45">
                      <span className="font-semibold text-white/65">
                        {c.displayName}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-white/90">
                      {c.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!commentsDisabled ? (
        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1">
            <input
              id="watch-desktop-comment-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void post();
                }
              }}
              placeholder={videoId ? "Add comment…" : "Select an episode…"}
              disabled={!videoId || sending}
              maxLength={500}
              className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/35 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void post()}
              disabled={!videoId || !text.trim() || sending}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--slop-violet)] text-[var(--slop-black)] transition enabled:hover:brightness-110 disabled:opacity-30"
              aria-label="Post comment"
            >
              <Send className="h-3.5 w-3.5 fill-current" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
