import { DEMO_DRAMAS, DEMO_VIDEOS } from "@/lib/demo-data";
import type { Drama, Video } from "@/lib/types";
import {
  loadUploadsCatalog,
  mergeSeedWithUploads,
} from "@/lib/uploads-catalog";

export type ResolvedShareVideo = {
  video: Video;
  drama: Drama | null;
};

/** Server-side resolve for /v/[slug] — seed + admin upload catalog. */
export async function resolveShareVideoBySlug(
  slug: string,
): Promise<ResolvedShareVideo | null> {
  const uploads = await loadUploadsCatalog();
  const { videos, dramas } = mergeSeedWithUploads(
    DEMO_VIDEOS,
    DEMO_DRAMAS,
    uploads,
  );
  const video = videos.find((v) => v.slug === slug && v.status === "published");
  if (!video) return null;
  const drama = dramas.find((d) => d.id === video.dramaId) ?? null;
  return { video, drama };
}
