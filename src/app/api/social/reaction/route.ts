import { NextResponse } from "next/server";
import {
  LIVE_REACTION_EMOJIS,
  listLiveReactions,
  publishLiveReaction,
  type LiveReaction,
} from "@/lib/social/live-reactions-store";

const ALLOWED = new Set<string>(LIVE_REACTION_EMOJIS);

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `rx_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  return `rx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Recent floating reactions for an episode — polled by every active viewer. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const episodeId = url.searchParams.get("episodeId")?.trim();
  if (!episodeId) {
    return NextResponse.json({ error: "episodeId required" }, { status: 400 });
  }
  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw ? Number(sinceRaw) : undefined;
  const reactions = await listLiveReactions({
    episodeId,
    since: Number.isFinite(since) ? since : undefined,
  });
  return NextResponse.json(
    { reactions, serverTime: Date.now() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

/** Publish a floating reaction so every viewer on the episode can see it. */
export async function POST(req: Request) {
  let body: {
    id?: string;
    episodeId?: string;
    emoji?: string;
    x?: number;
    y?: number;
    actorId?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const episodeId = body.episodeId?.trim();
  const emoji = body.emoji?.trim();
  if (!episodeId || !emoji || !ALLOWED.has(emoji)) {
    return NextResponse.json(
      { error: "episodeId and allowed emoji required" },
      { status: 400 },
    );
  }

  const x =
    typeof body.x === "number" && Number.isFinite(body.x)
      ? Math.min(90, Math.max(5, body.x))
      : 18 + Math.random() * 64;
  const y =
    typeof body.y === "number" && Number.isFinite(body.y)
      ? Math.min(80, Math.max(10, body.y))
      : 28 + Math.random() * 40;

  const reaction: LiveReaction = {
    id: body.id?.trim() || newId(),
    episodeId,
    emoji,
    x,
    y,
    at: Date.now(),
    actorId: body.actorId?.trim() || null,
  };

  await publishLiveReaction(reaction);
  return NextResponse.json({ reaction });
}
