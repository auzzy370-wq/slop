"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { VideoFeed } from "@/components/feed/video-feed";
import type { Video } from "@/lib/types";
import {
  mergeSeedWithUploads,
  type UploadsCatalog,
} from "@/lib/uploads-catalog-shared";
import { useSlopStore } from "@/store/slop-store";

export function VideoShareClient({
  slug,
  initialVideo,
  initialDramaId,
}: {
  slug: string;
  initialVideo: Video | null;
  initialDramaId: string | null;
}) {
  const videos = useSlopStore((s) => s.videos);
  const dramas = useSlopStore((s) => s.dramas);
  const hydrated = useSlopStore((s) => s.hydrated);
  const upsertVideo = useSlopStore((s) => s.upsertVideo);
  const upsertDrama = useSlopStore((s) => s.upsertDrama);

  const [catalogReady, setCatalogReady] = useState(Boolean(initialVideo));
  const [fallbackVideo, setFallbackVideo] = useState<Video | null>(initialVideo);

  // Seed the store with the server-resolved episode so the feed can play it
  // even before the async uploads hydrator finishes.
  useEffect(() => {
    if (!initialVideo) return;
    upsertVideo(initialVideo);
  }, [initialVideo, upsertVideo]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/catalog/uploads", { cache: "no-store" });
        if (!res.ok) return;
        const catalog = (await res.json()) as UploadsCatalog;
        if (cancelled) return;
        const state = useSlopStore.getState();
        const merged = mergeSeedWithUploads(state.videos, state.dramas, catalog);
        const hit = merged.videos.find(
          (v) => v.slug === slug && v.status === "published",
        );
        if (hit) {
          useSlopStore.setState({
            videos: merged.videos,
            dramas: merged.dramas,
          });
          setFallbackVideo(hit);
          const drama = merged.dramas.find((d) => d.id === hit.dramaId);
          if (drama) upsertDrama(drama);
        }
      } catch {
        /* keep whatever we already have */
      } finally {
        if (!cancelled) setCatalogReady(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [slug, upsertDrama]);

  const video = useMemo(() => {
    return (
      videos.find((v) => v.slug === slug && v.status === "published") ??
      fallbackVideo ??
      initialVideo
    );
  }, [videos, slug, fallbackVideo, initialVideo]);

  const dramaId = video?.dramaId ?? initialDramaId;

  if (!hydrated || !catalogReady) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--slop-violet)]" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-2xl">Video not found</h1>
        <p className="text-sm text-white/55">
          This clip may be unpublished or the link is wrong.
        </p>
        <Link href="/" className="text-[var(--slop-violet)]">
          Back to feed
        </Link>
      </div>
    );
  }

  return (
    <div className="slop-watch-shell">
      <Link
        href={(() => {
          const dramaSlug = dramas.find((d) => d.id === dramaId)?.slug;
          return dramaSlug ? `/drama/${dramaSlug}` : "/";
        })()}
        className="fixed left-4 z-50 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur top-[max(1rem,env(safe-area-inset-top))] lg:left-[max(1.5rem,calc((100vw-420px)/2-12rem))] lg:top-20"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div className="hidden lg:block" aria-hidden />
      <div className="slop-watch-stage">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--slop-violet)]" />
            </div>
          }
        >
          <VideoFeed
            section={dramaId ? "drama" : "for-you"}
            categoryId={dramaId ?? undefined}
            startVideoId={video.id}
          />
        </Suspense>
      </div>
      <div className="hidden lg:block" aria-hidden />
    </div>
  );
}
