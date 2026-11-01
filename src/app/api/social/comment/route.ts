import { NextResponse } from "next/server";
import { updateSocialStore } from "@/lib/social/engagement-store";
import type { Comment } from "@/lib/types";
import { uid } from "@/lib/utils";

type Body = {
  videoId?: string;
  actorId?: string;
  displayName?: string;
  avatarUrl?: string | null;
  text?: string;
  parentId?: string | null;
  replyToName?: string | null;
};

/** Post a comment / reply as guest or signed-in user. */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const videoId = body.videoId?.trim();
  const actorId = body.actorId?.trim();
  const displayName = (body.displayName || "Guest").trim().slice(0, 32);
  const text = (body.text || "").trim();
  const parentId = body.parentId?.trim() || null;
  const replyToName = body.replyToName?.trim()?.slice(0, 32) || null;

  if (!videoId || !actorId) {
    return NextResponse.json(
      { error: "videoId and actorId are required" },
      { status: 400 },
    );
  }
  if (text.length < 1 || text.length > 500) {
    return NextResponse.json(
      { error: "Comment must be 1–500 characters." },
      { status: 400 },
    );
  }
  if (actorId.length > 80 || videoId.length > 80) {
    return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
  }

  let created: Comment | null = null;
  let error: string | null = null;

  const store = await updateSocialStore((draft) => {
    if (parentId) {
      const parent = draft.comments.find(
        (c) => c.id === parentId && c.videoId === videoId,
      );
      if (!parent) {
        error = "Original comment not found.";
        return;
      }
    }

    const recent = draft.comments.filter(
      (c) =>
        c.userId === actorId &&
        Date.now() - new Date(c.createdAt).getTime() < 15_000,
    );
    if (recent.length >= 5) {
      error = "Slow down — rate limit hit.";
      return;
    }

    const cleaned = replyToName
      ? text.replace(
          new RegExp(
            `^@${replyToName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`,
          ),
          "",
        )
      : text;
    const bodyText = cleaned.trim() || text;

    created = {
      id: uid("cmt"),
      videoId,
      userId: actorId,
      displayName: displayName || "Guest",
      avatarUrl: body.avatarUrl ?? null,
      text: bodyText,
      createdAt: new Date().toISOString(),
      moderationStatus: "visible",
      parentId,
      replyToName,
    };
    draft.comments = [created, ...draft.comments];
  });

  if (error || !created) {
    return NextResponse.json(
      { error: error ?? "Could not post comment" },
      { status: 400 },
    );
  }

  const commentCount = store.comments.filter(
    (c) => c.videoId === videoId && c.moderationStatus !== "removed",
  ).length;

  return NextResponse.json({
    ok: true,
    comment: created,
    commentCount,
    comments: store.comments.filter((c) => c.moderationStatus !== "removed"),
  });
}
