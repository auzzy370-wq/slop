"use client";

import Link from "next/link";
import type { Drama } from "@/lib/types";
import { formatCount } from "@/lib/utils";

export function DramaCard({
  drama,
  size = "md",
}: {
  drama: Drama;
  size?: "sm" | "md" | "lg";
}) {
  const width =
    size === "lg" ? "w-44 sm:w-52" : size === "sm" ? "w-28 sm:w-32" : "w-36 sm:w-40";

  return (
    <Link
      href={`/drama/${drama.slug}`}
      className={`${width} shrink-0 snap-start group`}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-[var(--slop-panel)] transition duration-300 group-hover:border-[var(--slop-violet)]/50 group-hover:shadow-[0_12px_40px_rgba(185,154,255,0.15)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={drama.posterUrl}
          alt={drama.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5 pt-8">
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-white sm:text-sm">
            {drama.title}
          </p>
          <p className="mt-1 text-[10px] text-[var(--slop-lavender)]/80">
            {drama.episodeCount} eps
            {drama.viewCount > 0
              ? ` · ${formatCount(drama.viewCount)} views`
              : ""}
          </p>
        </div>
        {drama.trendingRank && drama.trendingRank <= 3 && (
          <span className="absolute left-2 top-2 rounded-md bg-[var(--slop-violet)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--slop-black)]">
            #{drama.trendingRank}
          </span>
        )}
      </div>
    </Link>
  );
}
