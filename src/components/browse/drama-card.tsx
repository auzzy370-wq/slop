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
      <div className="relative aspect-[2/3] overflow-hidden border border-white/10 bg-[var(--slop-panel)] transition duration-300 group-hover:border-[var(--slop-violet)]/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={drama.posterUrl}
          alt={drama.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2.5 pt-10">
          <p className="line-clamp-2 font-display text-xs font-semibold leading-snug tracking-tight text-white sm:text-sm">
            {drama.title}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/45">
            {drama.episodeCount} eps
            {drama.viewCount > 0
              ? ` · ${formatCount(drama.viewCount)}`
              : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}
