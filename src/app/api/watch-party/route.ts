import { NextResponse } from "next/server";
import { getParty, saveParty } from "@/lib/watch-party-store";
import type { WatchPartyState } from "@/lib/watch-party";

function roomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  }
  return Math.random().toString(36).slice(2, 12);
}

export async function GET(req: Request) {
  const room = new URL(req.url).searchParams.get("room")?.trim();
  if (!room) {
    return NextResponse.json({ error: "room required" }, { status: 400 });
  }
  const party = await getParty(room);
  return NextResponse.json({ party });
}

export async function POST(req: Request) {
  let body: {
    action?: string;
    roomId?: string;
    hostId?: string;
    episodeId?: string;
    dramaId?: string | null;
    positionSec?: number;
    paused?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (action === "create") {
    const episodeId = body.episodeId?.trim();
    const hostId = body.hostId?.trim();
    if (!episodeId || !hostId) {
      return NextResponse.json(
        { error: "episodeId and hostId required" },
        { status: 400 },
      );
    }
    const party: WatchPartyState = {
      roomId: roomId(),
      episodeId,
      dramaId: body.dramaId ?? null,
      positionSec: Math.max(0, body.positionSec ?? 0),
      paused: false,
      hostId,
      updatedAt: new Date().toISOString(),
    };
    await saveParty(party);
    return NextResponse.json({ party });
  }

  if (action === "update") {
    const id = body.roomId?.trim();
    const hostId = body.hostId?.trim();
    const episodeId = body.episodeId?.trim();
    if (!id || !hostId || !episodeId) {
      return NextResponse.json(
        { error: "roomId, hostId, episodeId required" },
        { status: 400 },
      );
    }
    const existing = await getParty(id);
    if (!existing) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    if (existing.hostId !== hostId) {
      return NextResponse.json({ error: "Only host can update" }, { status: 403 });
    }
    const party: WatchPartyState = {
      ...existing,
      episodeId,
      dramaId: body.dramaId ?? existing.dramaId,
      positionSec: Math.max(0, body.positionSec ?? existing.positionSec),
      paused: !!body.paused,
      updatedAt: new Date().toISOString(),
    };
    await saveParty(party);
    return NextResponse.json({ party });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
