import { NextResponse } from "next/server";
import { updateSocialStore } from "@/lib/social/engagement-store";

type Body = {
  fromActorId?: string;
  toActorId?: string;
};

/**
 * Reassign guest likes/comments onto a signed-in account so engagement
 * survives signup. Dedupes per video (and per comment id).
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fromActorId = body.fromActorId?.trim();
  const toActorId = body.toActorId?.trim();
  if (!fromActorId || !toActorId) {
    return NextResponse.json(
      { error: "fromActorId and toActorId are required" },
      { status: 400 },
    );
  }
  if (fromActorId === toActorId) {
    return NextResponse.json({
      ok: true,
      likesMoved: 0,
      commentsMoved: 0,
      likes: [],
      comments: [],
    });
  }
  if (fromActorId.length > 80 || toActorId.length > 80) {
    return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
  }

  let likesMoved = 0;
  let commentsMoved = 0;

  const store = await updateSocialStore((draft) => {
    const ownedLikeVideos = new Set(
      draft.likes
        .filter((l) => l.userId === toActorId)
        .map((l) => l.videoId),
    );

    const nextLikes = [];
    for (const like of draft.likes) {
      if (like.userId !== fromActorId) {
        nextLikes.push(like);
        continue;
      }
      if (ownedLikeVideos.has(like.videoId)) {
        // Drop guest duplicate — account already liked this episode.
        continue;
      }
      ownedLikeVideos.add(like.videoId);
      likesMoved += 1;
      nextLikes.push({ ...like, userId: toActorId });
    }
    draft.likes = nextLikes;

    const nextComments = [];
    for (const comment of draft.comments) {
      if (comment.userId !== fromActorId) {
        nextComments.push(comment);
        continue;
      }
      commentsMoved += 1;
      nextComments.push({
        ...comment,
        userId: toActorId,
      });
    }
    draft.comments = nextComments;
  });

  return NextResponse.json({
    ok: true,
    likesMoved,
    commentsMoved,
    likes: store.likes,
    comments: store.comments,
  });
}
