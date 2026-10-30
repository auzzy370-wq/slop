"use client";

import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { VideoFeed } from "@/components/feed/video-feed";
import { useSlopStore } from "@/store/slop-store";

export function VideoShareClient({ slug }: { slug: string }) {
  const videos = useSlopStore((s) => s.videos);
  const video = videos.find((v) => v.slug === slug && v.status === "published");

  if (!video) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-2xl">
          Video not found
        </h1>
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
    <div className="relative">
      <Link
        href="/"
        className="absolute left-4 z-50 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur top-[max(1rem,env(safe-area-inset-top))]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to feed
      </Link>
      <Suspense fallback={null}>
        <VideoFeed section="for-you" startVideoId={video.id} />
      </Suspense>
    </div>
  );
}
