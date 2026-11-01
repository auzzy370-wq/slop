import { NextResponse } from "next/server";
import { updateSocialStore } from "@/lib/social/engagement-store";

type Body = {
  videoId?: string;
  actorId?: string;
};

/**
 * Toggle a like for any viewer (guest or account).
 * actorId should be a stable anon id or user id.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const videoId = body.videoId?.trim();
  const actorId = body.actorId?.trim();
  if (!videoId || !actorId) {
    return NextResponse.json(
      { error: "videoId and actorId are required" },
      { status: 400 },
    );
  }
  if (actorId.length > 80 || videoId.length > 80) {
    return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
  }

  const store = await updateSocialStore((draft) => {
    const existing = draft.likes.find(
      (l) => l.userId === actorId && l.videoId === videoId,
    );
    if (existing) {
      draft.likes = draft.likes.filter((l) => l !== existing);
    } else {
      draft.likes.push({
        userId: actorId,
        videoId,
        createdAt: new Date().toISOString(),
      });
    }
  });

  const liked = store.likes.some(
    (l) => l.userId === actorId && l.videoId === videoId,
  );
  const likeCount = store.likes.filter((l) => l.videoId === videoId).length;

  return NextResponse.json({
    ok: true,
    liked,
    likeCount,
    likes: store.likes,
  });
}
