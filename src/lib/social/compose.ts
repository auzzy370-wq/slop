import type { SocialAutoPostPayload } from "./types";

export function siteBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3456"
  );
}

export function watchUrlFor(payload: SocialAutoPostPayload) {
  const base = siteBaseUrl();
  return `${base}/watch?drama=${encodeURIComponent(payload.dramaId)}&dramaSlug=${encodeURIComponent(payload.dramaSlug)}&start=${encodeURIComponent(payload.episodeId)}`;
}

export function dramaUrlFor(payload: SocialAutoPostPayload) {
  return `${siteBaseUrl()}/drama/${payload.dramaSlug}`;
}

export function absoluteAssetUrl(maybeRelative?: string | null) {
  if (!maybeRelative) return null;
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  return `${siteBaseUrl()}${maybeRelative.startsWith("/") ? "" : "/"}${maybeRelative}`;
}

/** Short caption for X / Telegram / Discord embeds. */
export function composeCaption(payload: SocialAutoPostPayload) {
  const watch = watchUrlFor(payload);
  const blurb = (payload.description || "").trim().slice(0, 140);
  const lines = [
    `📺 New on SLOP — ${payload.dramaTitle}`,
    `Episode ${payload.episodeNumber}: ${payload.episodeTitle}`,
  ];
  if (blurb) lines.push(blurb);
  lines.push("");
  lines.push(`Watch free → ${watch}`);
  lines.push("#SLOP #ShortDrama");
  return lines.join("\n");
}

export function allowedEpisodeNumbers(): number[] {
  const raw = process.env.SOCIAL_AUTO_POST_EPISODES || "1,2";
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function autoPostEnabled() {
  const flag = (process.env.SOCIAL_AUTO_POST_ENABLED || "true").toLowerCase();
  return flag !== "0" && flag !== "false" && flag !== "off";
}
