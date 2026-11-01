/** Detect and rewrite cloud media URLs for playback / migration. */

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

/**
 * When Vercel Blob public access is suspended, route playback through our
 * authenticated proxy so existing episodes keep working without reupload.
 * R2 / local / seed URLs pass through unchanged.
 */
export function resolvePlaybackUrl(url: string) {
  if (!url) return url;
  if (!isVercelBlobUrl(url)) return url;
  // Already proxied
  if (url.startsWith("/api/media/blob")) return url;
  return `/api/media/blob?u=${encodeURIComponent(url)}`;
}
