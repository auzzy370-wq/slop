/** Client helpers for shared floating episode reactions. */

export type LiveReactionPayload = {
  id: string;
  episodeId: string;
  emoji: string;
  x: number;
  y: number;
  at: number;
  actorId?: string | null;
};

export async function publishLiveReaction(input: {
  id: string;
  episodeId: string;
  emoji: string;
  x: number;
  y: number;
  actorId?: string | null;
}): Promise<LiveReactionPayload | null> {
  try {
    const res = await fetch("/api/social/reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { reaction?: LiveReactionPayload };
    return json.reaction ?? null;
  } catch {
    return null;
  }
}

export async function fetchLiveReactions(input: {
  episodeId: string;
  since: number;
}): Promise<LiveReactionPayload[]> {
  try {
    const params = new URLSearchParams({
      episodeId: input.episodeId,
      since: String(input.since),
    });
    const res = await fetch(`/api/social/reaction?${params}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { reactions?: LiveReactionPayload[] };
    return Array.isArray(json.reactions) ? json.reactions : [];
  } catch {
    return [];
  }
}
