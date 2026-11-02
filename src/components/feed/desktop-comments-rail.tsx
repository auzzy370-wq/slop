"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { toast } from "sonner";
import type { Comment } from "@/lib/types";
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
  const deleteComment = useSlopStore((s) => s.deleteComment);
  const mergeSharedEngagement = useSlopStore((s) => s.mergeSharedEngagement);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const actor = resolveSocialActor(user);

  const visible = useMemo(() => {
    if (!videoId) return [];
    return comments.filter(
      (c) => c.videoId === videoId && c.moderationStatus === "visible",
    );
  }, [comments, videoId]);

  const roots = useMemo(
    () =>
      visible
        .filter((c) => !c.parentId)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [visible],
  );

  const repliesByParent = useMemo(() => {
    const map = new Map<string, Comment[]>();
    for (const c of visible) {
      if (!c.parentId) continue;
      const list = map.get(c.parentId) ?? [];
      list.push(c);
      map.set(c.parentId, list);
    }
    for (const [, list] of map) {
      list.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return map;
  }, [visible]);

  const replyCount = useMemo(
    () => visible.filter((c) => !!c.parentId).length,
    [visible],
  );

  const clearReply = useCallback(() => {
    setReplyTo(null);
    setText((prev) => (prev.startsWith("@") ? "" : prev));
  }, []);

  const startReply = useCallback(
    (comment: Comment) => {
      // Attach under the root thread (same as mobile sheet).
      const rootId = comment.parentId ?? comment.id;
      const root = visible.find((c) => c.id === rootId) ?? comment;
      setReplyTo(root);
      setExpanded((prev) => ({ ...prev, [root.id]: true }));
      const mention = `@${comment.displayName} `;
      setText((prev) =>
        !prev.trim() || prev.startsWith("@") ? mention : prev,
      );
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [visible],
  );

  const post = async () => {
    const posted = text.trim();
    if (!posted || !videoId || sending) return;
    const parentId = replyTo?.id;
    const replyToName = replyTo?.displayName;
    setText("");
    setSending(true);
    const clearTarget = replyTo;
    setReplyTo(null);
    try {
      const remote = await syncAddComment({
        videoId,
        text: posted,
        user,
        parentId,
        replyToName,
      });
      if (remote.ok && remote.comments) {
        mergeSharedEngagement({
          likes: useSlopStore.getState().likes,
          comments: remote.comments,
        });
        requestEngagementRefresh();
        if (parentId) {
          setExpanded((prev) => ({ ...prev, [parentId]: true }));
        }
        toast.success(parentId ? "Reply posted" : "Comment posted");
        return;
      }
      const local = addComment(videoId, posted, {
        parentId,
        replyToName,
        actor: {
          id: actor.id,
          displayName: actor.displayName,
          avatarUrl: actor.avatarUrl,
        },
      });
      if (!local.ok) {
        setText(posted);
        if (clearTarget) setReplyTo(clearTarget);
        toast.error(remote.error ?? local.error ?? "Could not post");
      } else if (parentId) {
        setExpanded((prev) => ({ ...prev, [parentId]: true }));
        toast.message("Reply saved on this device");
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
          {formatCount(roots.length + replyCount)}
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
        ) : roots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <p className="text-sm font-semibold text-white/80">
              Be the first to comment
            </p>
            <p className="text-xs text-white/40">
              Say what just happened — keep it short.
            </p>
          </div>
        ) : (
          <ul className="space-y-1 pb-2">
            {roots.map((c) => {
              const replies = repliesByParent.get(c.id) ?? [];
              const showAll = !!expanded[c.id];
              const visibleReplies = showAll ? replies : replies.slice(0, 1);
              const hiddenCount = Math.max(
                0,
                replies.length - visibleReplies.length,
              );
              const canDelete =
                actor.id === c.userId || user?.role === "admin";

              return (
                <li key={c.id}>
                  <DesktopCommentRow
                    comment={c}
                    onReply={() => startReply(c)}
                    canDelete={canDelete}
                    onDelete={() => deleteComment(c.id)}
                  />
                  {visibleReplies.length > 0 ? (
                    <ul className="ml-10 border-l border-white/10 pl-2.5">
                      {visibleReplies.map((r) => (
                        <li key={r.id}>
                          <DesktopCommentRow
                            comment={r}
                            compact
                            onReply={() => startReply(r)}
                            canDelete={
                              actor.id === r.userId || user?.role === "admin"
                            }
                            onDelete={() => deleteComment(r.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {hiddenCount > 0 ? (
                    <button
                      type="button"
                      className="ml-10 px-1 py-1.5 text-[12px] font-semibold text-white/45 transition hover:text-white/70"
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [c.id]: true }))
                      }
                    >
                      View {hiddenCount} more{" "}
                      {hiddenCount === 1 ? "reply" : "replies"}
                    </button>
                  ) : null}
                  {showAll && replies.length > 1 ? (
                    <button
                      type="button"
                      className="ml-10 px-1 py-1.5 text-[12px] font-semibold text-white/35 transition hover:text-white/55"
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [c.id]: false }))
                      }
                    >
                      Hide replies
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!commentsDisabled ? (
        <div className="shrink-0 border-t border-white/10 p-3">
          {replyTo ? (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-white/[0.05] px-3 py-1.5">
              <p className="truncate text-[12px] text-white/55">
                Replying to{" "}
                <span className="font-semibold text-white/80">
                  @{replyTo.displayName}
                </span>
              </p>
              <button
                type="button"
                onClick={clearReply}
                className="flex h-6 w-6 items-center justify-center rounded-full text-white/45 hover:bg-white/10 hover:text-white"
                aria-label="Cancel reply"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1">
            <input
              id="watch-desktop-comment-input"
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && replyTo) {
                  e.preventDefault();
                  clearReply();
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void post();
                }
              }}
              placeholder={
                !videoId
                  ? "Select an episode…"
                  : replyTo
                    ? `Reply to @${replyTo.displayName}…`
                    : "Add comment…"
              }
              disabled={!videoId || sending}
              maxLength={500}
              className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/35 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void post()}
              disabled={!videoId || !text.trim() || sending}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--slop-violet)] text-[var(--slop-black)] transition enabled:hover:brightness-110 disabled:opacity-30"
              aria-label={replyTo ? "Post reply" : "Post comment"}
            >
              <Send className="h-3.5 w-3.5 fill-current" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DesktopCommentRow({
  comment,
  onReply,
  canDelete,
  onDelete,
  compact = false,
}: {
  comment: Comment;
  onReply: () => void;
  canDelete: boolean;
  onDelete: () => void;
  compact?: boolean;
}) {
  const initial = (comment.displayName || "?").slice(0, 1).toUpperCase();
  return (
    <div className={`flex gap-2.5 ${compact ? "py-1.5" : "py-2"}`}>
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--slop-violet)]/25 font-bold text-[var(--slop-lavender)] ${
          compact ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[11px]"
        }`}
        aria-hidden
      >
        {comment.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comment.avatarUrl}
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
            {comment.displayName}
          </span>
        </p>
        <p className="mt-0.5 text-[13px] leading-snug text-white/90">
          {comment.replyToName ? (
            <>
              <span className="font-semibold text-[var(--slop-lavender)]">
                @{comment.replyToName}{" "}
              </span>
              {comment.text.replace(
                new RegExp(`^@${comment.replyToName}\\s*`),
                "",
              )}
            </>
          ) : (
            comment.text
          )}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            className="text-[11px] font-semibold text-white/40 transition hover:text-white/70"
            onClick={onReply}
          >
            Reply
          </button>
          {canDelete ? (
            <button
              type="button"
              className="text-[11px] font-medium text-white/30 transition hover:text-red-400"
              onClick={onDelete}
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
