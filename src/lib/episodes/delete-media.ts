import { unlink } from "fs/promises";
import path from "path";

export type DeleteMediaResult = {
  deletedUrls: string[];
  deletedPaths: string[];
  errors: string[];
};

function paddedEpisode(n: number) {
  return String(Math.floor(n)).padStart(2, "0");
}

function isBlobUrl(url: string) {
  return (
    /^https?:\/\//i.test(url) &&
    /(vercel-storage\.com|blob\.vercel-storage\.com|public\.blob\.vercel-storage\.com)/i.test(
      url,
    )
  );
}

function isLocalUploadUrl(url: string) {
  return url.startsWith("/uploads/") || url.startsWith("uploads/");
}

/**
 * Free storage for a deleted episode:
 * - delete the known video URL from Vercel Blob
 * - delete every Blob object under slop/{dramaId}/ep-{NN}* (re-uploads)
 * - delete local public/uploads/{dramaId}/ep-{NN}.mp4 when present
 *
 * Seed/demo files under /videos/ are left alone (repo assets).
 */
export async function deleteEpisodeMedia(input: {
  videoUrl?: string | null;
  dramaId?: string | null;
  episodeNumber?: number | null;
}): Promise<DeleteMediaResult> {
  const deletedUrls: string[] = [];
  const deletedPaths: string[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  const dramaId = input.dramaId?.trim() || null;
  const episodeNumber =
    typeof input.episodeNumber === "number" &&
    Number.isFinite(input.episodeNumber)
      ? Math.floor(input.episodeNumber)
      : null;
  const videoUrl = input.videoUrl?.trim() || null;

  const tryDelBlobUrl = async (url: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      errors.push("BLOB_READ_WRITE_TOKEN missing — could not delete cloud file");
      return;
    }
    try {
      const { del } = await import("@vercel/blob");
      await del(url);
      deletedUrls.push(url);
    } catch (err) {
      errors.push(
        err instanceof Error ? err.message : `Failed to delete ${url}`,
      );
    }
  };

  // 1) Exact URL from the episode row
  if (videoUrl && isBlobUrl(videoUrl)) {
    await tryDelBlobUrl(videoUrl);
  }

  // 2) Sweep Blob prefix for this drama/episode (covers renamed re-uploads)
  if (dramaId && episodeNumber != null && process.env.BLOB_READ_WRITE_TOKEN) {
    const ep = paddedEpisode(episodeNumber);
    const prefixes = [
      `slop/${dramaId}/ep-${ep}`,
      `slop/${dramaId}/ep-${episodeNumber}-`,
      `slop/${dramaId}/ep-${episodeNumber}.`,
    ];
    try {
      const { list } = await import("@vercel/blob");
      for (const prefix of prefixes) {
        let cursor: string | undefined;
        do {
          const page = await list({ prefix, limit: 1000, cursor });
          for (const blob of page.blobs) {
            if (!/\.(mp4|mov|webm)$/i.test(blob.pathname)) continue;
            // Match ep-05… or ep-5… for this episode only
            const m = blob.pathname.match(
              new RegExp(
                `^slop/${dramaId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/ep-0*${episodeNumber}(?:[-_.]|$)`,
                "i",
              ),
            );
            if (!m) continue;
            await tryDelBlobUrl(blob.url);
          }
          cursor = page.hasMore ? page.cursor : undefined;
        } while (cursor);
      }
    } catch (err) {
      errors.push(
        err instanceof Error
          ? `Blob list failed: ${err.message}`
          : "Blob list failed",
      );
    }
  }

  // 3) Local public/uploads copy
  const localCandidates: string[] = [];
  if (videoUrl && isLocalUploadUrl(videoUrl)) {
    const rel = videoUrl.replace(/^\//, "");
    localCandidates.push(path.join(process.cwd(), "public", rel));
  }
  if (dramaId && episodeNumber != null) {
    const safeDrama = dramaId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    const ep = paddedEpisode(episodeNumber);
    localCandidates.push(
      path.join(
        process.cwd(),
        "public",
        "uploads",
        safeDrama,
        `ep-${ep}.mp4`,
      ),
      path.join(
        process.cwd(),
        "public",
        "uploads",
        dramaId,
        `ep-${ep}.mp4`,
      ),
    );
  }

  for (const abs of localCandidates) {
    if (seen.has(abs)) continue;
    seen.add(abs);
    try {
      await unlink(abs);
      deletedPaths.push(abs);
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      if (code !== "ENOENT") {
        errors.push(
          err instanceof Error
            ? `Local delete failed: ${err.message}`
            : "Local delete failed",
        );
      }
    }
  }

  return { deletedUrls, deletedPaths, errors };
}
