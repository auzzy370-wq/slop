import { NextResponse } from "next/server";
import { readSocialStore } from "@/lib/social/engagement-store";

/** Shared likes + comments visible to every viewer (guest or signed-in). */
export async function GET() {
  const store = await readSocialStore();
  return NextResponse.json(
    {
      likes: store.likes,
      comments: store.comments.filter(
        (c) => c.moderationStatus !== "removed",
      ),
      updatedAt: store.updatedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
