"use client";

import Link from "next/link";
import type { Drama } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";

export function DramaCard({
  drama,
  size = "md",
}: {
  drama: Drama;
  size?: "sm" | "md" | "lg" | "fluid";
}) {
  const width =
    size === "fluid"
      ? "w-full"
      : size === "lg"
        ? "w-44 sm:w-52"
        : size === "sm"
          ? "w-28 sm:w-32"
          : "w-36 sm:w-40";

  return (
    <Link
      href={`/drama/${drama.slug}`}
      className={cn(
        width,
        "shrink-0 snap-start group lg:w-full",
        size !== "fluid" && "lg:min-w-0",
      )}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-[var(--slop-panel)] transition duration-300 group-hover:border-[var(--slop-violet)]/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={drama.posterUrl}
          alt={drama.title}
          width={320}
          height={480}
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
      </div>
    </Link>
  );
}
