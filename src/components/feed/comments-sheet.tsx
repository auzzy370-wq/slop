"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Heart, Send, X } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import type { Comment } from "@/lib/types";
import { formatCount } from "@/lib/utils";

function shortAge(iso: string) {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: false })
    .replace(" seconds", "s")
    .replace(" second", "s")
    .replace(" minutes", "m")
    .replace(" minute", "m")
    .replace(" hours", "h")
    .replace(" hour", "h")
    .replace(" days", "d")
    .replace(" day", "d")
    .replace(" months", "mo")
    .replace(" month", "mo")
    .replace(" years", "y")
    .replace(" year", "y");
}

export function CommentsSheet({
  open,
  onClose,
  comments,
  commentsDisabled,
  commentText,
  onCommentTextChange,
  onSubmit,
  canComment,
  currentUserId,
  isAdmin,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  comments: Comment[];
  commentsDisabled: boolean;
  commentText: string;
  onCommentTextChange: (value: string) => void;
  onSubmit: (opts?: { parentId?: string; replyToName?: string }) => void;
  canComment: boolean;
  currentUserId?: string;
  isAdmin?: boolean;
  onDelete: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragY = useRef(0);
  const dragging = useRef(false);
  const [offset, setOffset] = useState(0);
  const [entered, setEntered] = useState(false);
  const [likedLocal, setLikedLocal] = useState<Record<string, boolean>>({});
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) {
      setEntered(false);
      setOffset(0);
      setReplyTo(null);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (replyTo) setReplyTo(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, replyTo]);

  const roots = useMemo(
    () => comments.filter((c) => !c.parentId),
    [comments],
  );

  const repliesByParent = useMemo(() => {
    const map = new Map<string, Comment[]>();
    for (const c of comments) {
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
  }, [comments]);

  const startReply = useCallback(
    (comment: Comment) => {
      // Reply always attaches to the root thread (TikTok-style)
      const rootId = comment.parentId ?? comment.id;
      const root =
        comments.find((c) => c.id === rootId) ?? comment;
      setReplyTo(root);
      setExpanded((prev) => ({ ...prev, [root.id]: true }));
      const mention = `@${comment.displayName} `;
      if (!commentText.trim() || commentText.startsWith("@")) {
        onCommentTextChange(mention);
      } else if (!commentText.includes(`@${comment.displayName}`)) {
        onCommentTextChange(`${mention}${commentText}`);
      }
      window.setTimeout(() => {
        inputRef.current?.focus();
        const el = inputRef.current;
        if (el) {
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      }, 50);
    },
    [commentText, comments, onCommentTextChange],
  );

  const clearReply = useCallback(() => {
    setReplyTo(null);
    if (commentText.startsWith("@")) {
      onCommentTextChange(commentText.replace(/^@\S+\s*/, ""));
    }
  }, [commentText, onCommentTextChange]);

  const onHandleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    dragY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dy = Math.max(0, e.clientY - dragY.current);
    setOffset(dy);
  };

  const onHandleUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (offset > 120) {
      onClose();
      setOffset(0);
      return;
    }
    setOffset(0);
  };

  const submit = useCallback(() => {
    if (!commentText.trim()) return;
    onSubmit(
      replyTo
        ? { parentId: replyTo.id, replyToName: replyTo.displayName }
        : undefined,
    );
    setReplyTo(null);
  }, [commentText, onSubmit, replyTo]);

  if (!open) return null;

  const countLabel =
    comments.length === 0
      ? "Comments"
      : `${formatCount(comments.length)} comment${comments.length === 1 ? "" : "s"}`;

  return (
    <div className="absolute inset-0 z-[70] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close comments"
        className={`slop-comments-scrim absolute inset-0 ${entered ? "is-on" : ""}`}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={countLabel}
        className={`slop-comments-sheet relative z-10 flex max-h-[68%] min-h-[48%] w-full flex-col ${
          entered ? "is-open" : ""
        }`}
        style={{
          transform: offset ? `translateY(${offset}px)` : undefined,
          transition: dragging.current ? "none" : undefined,
        }}
      >
        <div
          className="flex shrink-0 touch-none flex-col items-center pb-1 pt-2"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <span className="slop-comments-handle" aria-hidden />
          <div className="mt-2 flex w-full items-center justify-between px-4">
            <span className="w-8" aria-hidden />
            <p className="text-[13px] font-semibold text-white/90">{countLabel}</p>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2">
          {commentsDisabled ? (
            <p className="px-2 py-10 text-center text-sm text-white/45">
              Comments are turned off for this episode.
            </p>
          ) : roots.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <p className="text-[15px] font-semibold text-white/80">
                Be the first to comment
              </p>
              <p className="text-[13px] text-white/40">
                Say what just happened — keep it short.
              </p>
            </div>
          ) : (
            <ul className="space-y-0.5 pb-2">
              {roots.map((c, i) => {
                const replies = repliesByParent.get(c.id) ?? [];
                const showAll = !!expanded[c.id];
                const visibleReplies = showAll ? replies : replies.slice(0, 1);
                const hiddenCount = Math.max(0, replies.length - visibleReplies.length);

                return (
                  <li key={c.id} className="slop-comment-row" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                    <CommentRow
                      comment={c}
                      liked={!!likedLocal[c.id]}
                      onToggleLike={() =>
                        setLikedLocal((prev) => ({
                          ...prev,
                          [c.id]: !prev[c.id],
                        }))
                      }
                      onReply={() => startReply(c)}
                      canDelete={
                        currentUserId === c.userId || !!isAdmin
                      }
                      onDelete={() => onDelete(c.id)}
                    />
                    {visibleReplies.length > 0 ? (
                      <ul className="ml-12 border-l border-white/10 pl-3">
                        {visibleReplies.map((r) => (
                          <li key={r.id}>
                            <CommentRow
                              comment={r}
                              compact
                              liked={!!likedLocal[r.id]}
                              onToggleLike={() =>
                                setLikedLocal((prev) => ({
                                  ...prev,
                                  [r.id]: !prev[r.id],
                                }))
                              }
                              onReply={() => startReply(r)}
                              canDelete={
                                currentUserId === r.userId || !!isAdmin
                              }
                              onDelete={() => onDelete(r.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {hiddenCount > 0 ? (
                      <button
                        type="button"
                        className="ml-12 px-1 py-1.5 text-[12px] font-semibold text-white/45 transition hover:text-white/70"
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [c.id]: true }))
                        }
                      >
                        View {hiddenCount} more {hiddenCount === 1 ? "reply" : "replies"}
                      </button>
                    ) : null}
                    {showAll && replies.length > 1 ? (
                      <button
                        type="button"
                        className="ml-12 px-1 py-1.5 text-[12px] font-semibold text-white/35 transition hover:text-white/55"
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
          <div className="slop-comments-composer shrink-0 border-t border-white/10 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2.5">
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
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3.5 py-1.5">
                <input
                  ref={inputRef}
                  value={commentText}
                  onChange={(e) => onCommentTextChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={
                    replyTo
                      ? `Reply to @${replyTo.displayName}…`
                      : canComment
                        ? "Add comment…"
                        : "Comments are turned off"
                  }
                  maxLength={500}
                  className="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
                />
                <button
                  type="button"
                  onClick={submit}
                  disabled={!commentText.trim()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--slop-violet)] text-[var(--slop-black)] transition enabled:hover:brightness-110 disabled:opacity-30"
                  aria-label={replyTo ? "Post reply" : "Post comment"}
                >
                  <Send className="h-3.5 w-3.5 fill-current" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  liked,
  onToggleLike,
  onReply,
  canDelete,
  onDelete,
  compact = false,
}: {
  comment: Comment;
  liked: boolean;
  onToggleLike: () => void;
  onReply: () => void;
  canDelete: boolean;
  onDelete: () => void;
  compact?: boolean;
}) {
  const initial = (comment.displayName || "?").slice(0, 1).toUpperCase();
  return (
    <div className={`flex gap-3 px-1 ${compact ? "py-2" : "py-2.5"}`}>
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--slop-violet)]/25 font-bold text-[var(--slop-lavender)] ${
          compact ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-[12px]"
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
        <p className="text-[12px] leading-tight">
          <span className="font-semibold text-white/55">
            {comment.displayName}
          </span>
          <span className="text-white/25"> · </span>
          <span className="text-white/35">{shortAge(comment.createdAt)}</span>
        </p>
        <p className="mt-1 text-[14px] leading-snug text-white/90">
          {comment.replyToName ? (
            <>
              <span className="font-semibold text-[var(--slop-lavender)]">
                @{comment.replyToName}{" "}
              </span>
              {comment.text.replace(new RegExp(`^@${comment.replyToName}\\s*`), "")}
            </>
          ) : (
            comment.text
          )}
        </p>
        <div className="mt-1.5 flex items-center gap-3">
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
      <button
        type="button"
        className="mt-1 flex shrink-0 flex-col items-center gap-0.5 text-white/40 transition hover:text-white/70"
        aria-label="Like comment"
        onClick={onToggleLike}
      >
        <Heart
          className={`h-[15px] w-[15px] ${
            liked ? "fill-[#ff3040] text-[#ff3040]" : "fill-transparent"
          }`}
        />
        <span className="text-[10px] tabular-nums">{liked ? "1" : ""}</span>
      </button>
    </div>
  );
}
