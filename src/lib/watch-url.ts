/** Build /watch links that keep series playback locked to one drama. */

export function watchHref(input: {
  episodeId?: string | null;
  dramaId?: string | null;
  dramaSlug?: string | null;
  feed?: string | null;
}) {
  const params = new URLSearchParams();
  if (input.episodeId) params.set("start", input.episodeId);
  if (input.dramaId) params.set("drama", input.dramaId);
  if (input.dramaSlug) params.set("dramaSlug", input.dramaSlug);
  if (input.feed) params.set("feed", input.feed);
  const q = params.toString();
  return q ? `/watch?${q}` : "/watch";
}
