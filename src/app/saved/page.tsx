"use client";

import Link from "next/link";
import { Suspense } from "react";
import { VideoFeed } from "@/components/feed/video-feed";
import { useSlopStore } from "@/store/slop-store";

export default function SavedPage() {
  const user = useSlopStore((s) => s.currentUser);

  if (!user) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="font-display text-2xl">
          Saved videos
        </h1>
        <p className="text-sm text-white/55">Sign in to view your saves.</p>
        <Link href="/auth/sign-in" className="text-[var(--slop-violet)]">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <VideoFeed section="saved" />
    </Suspense>
  );
}
