/** Detect and rewrite cloud media URLs for playback / migration. */

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
  if (!url) return url;
  if (!isVercelBlobUrl(url)) return url;
  if (url.startsWith("/api/media/blob")) return url;
  if (blobPlaybackBlocked) return url; // fail fast on direct URL; UI shows storage message
  return `/api/media/blob?u=${encodeURIComponent(url)}`;
}
