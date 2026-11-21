/** Detect and rewrite cloud media URLs for playback / migration. */

/**
 * Seed library paths that used to be served from `public/`.
 * When `R2_PUBLIC_BASE_URL` is set, `next.config.ts` inlines it as
 * `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` so client and server agree.
 */
const SEED_MEDIA_PATH = /^\/(videos|thumbnails|posters|banners)\//;

export function publicMediaBaseUrl() {
  return (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
}

function pathnameOf(url: string): string | null {
  if (url.startsWith("/")) {
    return url.split("?")[0]?.split("#")[0] || url;
  }
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

/** True for the shared seed library (`/videos`, `/thumbnails`, `/posters`, `/banners`). */
export function isSeedLibraryMediaUrl(url: string) {
  if (!url) return false;
  const path = pathnameOf(url);
  if (path && SEED_MEDIA_PATH.test(path)) return true;
  const base = publicMediaBaseUrl();
  if (!base || (url !== base && !url.startsWith(`${base}/`))) return false;
  const key = url.slice(base.length + 1).split("?")[0]?.split("#")[0] || "";
  return /^(videos|thumbnails|posters|banners)\//.test(key);
}

/**
 * Rewrite a seed-library path to the R2 public URL.
 * Absolute URLs (R2, Blob, Supabase) pass through.
 * With no public base configured, the original site path is kept so local
 * `public/` files still play in dev.
 */
export function resolvePublicMediaUrl(url: string) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  const pathname = path.split("?")[0]?.split("#")[0] || path;
  if (!SEED_MEDIA_PATH.test(pathname)) return url;
  const base = publicMediaBaseUrl();
  if (!base) return url.startsWith("/") ? url : path;
  return `${base}${path}`;
}

let blobPlaybackBlocked = false;

export function setBlobPlaybackBlocked(blocked: boolean) {
  blobPlaybackBlocked = blocked;
}

export function isBlobPlaybackBlocked() {
  return blobPlaybackBlocked;
}

export function isVercelBlobUrl(url: string) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith(".blob.vercel-storage.com") ||
      host.endsWith(".public.blob.vercel-storage.com") ||
      host === "blob.vercel-storage.com"
    );
  } catch {
    return false;
  }
}

export function isPlayableVideoUrl(url: string) {
  if (!url?.trim()) return false;
  if (isVercelBlobUrl(url) && blobPlaybackBlocked) return false;
  return true;
}

/**
 * When Vercel Blob public access is suspended, route playback through our
 * authenticated proxy so existing episodes keep working without reupload.
 * If the store is fully blocked (reads return 403 even with the token),
 * callers should skip Blob URLs entirely — proxy cannot help.
 * R2 / local / seed URLs pass through unchanged.
 */
export function resolvePlaybackUrl(url: string) {
  const resolved = resolvePublicMediaUrl(url);
  if (!resolved) return resolved;
  if (!isVercelBlobUrl(resolved)) return resolved;
  if (resolved.startsWith("/api/media/blob")) return resolved;
  if (blobPlaybackBlocked) return resolved;
  return `/api/media/blob?u=${encodeURIComponent(resolved)}`;
}
