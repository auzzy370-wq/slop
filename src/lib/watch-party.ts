/** Client helpers for watch-together rooms. */

export type WatchPartyState = {
  roomId: string;
  episodeId: string;
  dramaId: string | null;
  positionSec: number;
  paused: boolean;
  hostId: string;
  updatedAt: string;
};

export function newPartyHostId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `host_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `host_${Math.random().toString(36).slice(2, 10)}`;
}

export async function createWatchParty(input: {
  episodeId: string;
  dramaId?: string | null;
  positionSec?: number;
  hostId: string;
}): Promise<WatchPartyState | null> {
  try {
    const res = await fetch("/api/watch-party", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        ...input,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { party?: WatchPartyState };
    return json.party ?? null;
  } catch {
    return null;
  }
}

export async function updateWatchParty(input: {
  roomId: string;
  hostId: string;
  episodeId: string;
  dramaId?: string | null;
  positionSec: number;
  paused: boolean;
}): Promise<WatchPartyState | null> {
  try {
    const res = await fetch("/api/watch-party", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", ...input }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { party?: WatchPartyState };
    return json.party ?? null;
  } catch {
    return null;
  }
}

export async function fetchWatchParty(
  roomId: string,
): Promise<WatchPartyState | null> {
  try {
    const res = await fetch(
      `/api/watch-party?room=${encodeURIComponent(roomId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { party?: WatchPartyState | null };
    return json.party ?? null;
  } catch {
    return null;
  }
}

export function watchPartyHref(input: {
  roomId: string;
  episodeId: string;
  dramaId?: string | null;
}) {
  const params = new URLSearchParams();
  params.set("start", input.episodeId);
  if (input.dramaId) params.set("drama", input.dramaId);
  params.set("party", input.roomId);
  return `/watch?${params.toString()}`;
}
