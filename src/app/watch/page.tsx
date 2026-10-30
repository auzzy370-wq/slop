"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { VideoFeed } from "@/components/feed/video-feed";

function WatchInner() {
  const params = useSearchParams();
  const start = params.get("start") ?? undefined;
  const dramaId = params.get("drama") ?? undefined;
  const dramaSlug = params.get("dramaSlug") ?? undefined;
  const feed = params.get("feed");

  return (
    <div className="relative bg-black">
      <Link
        href={dramaSlug ? `/drama/${dramaSlug}` : "/"}
        className="absolute left-4 z-50 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur top-[max(1rem,env(safe-area-inset-top))]"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <VideoFeed
        section={dramaId ? "drama" : feed === "trending" ? "trending" : "for-you"}
        categoryId={dramaId ?? undefined}
        startVideoId={start}
      />
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-black">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--slop-violet)]" />
        </div>
      }
    >
      <WatchInner />
    </Suspense>
  );
}
