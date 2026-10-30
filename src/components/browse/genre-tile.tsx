"use client";

import Link from "next/link";
import type { Category, Drama } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GenreTile({
  category,
  coverUrl,
  count,
  size = "md",
  className,
}: {
  category: Category;
  coverUrl?: string | null;
  count?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims =
    size === "lg"
      ? "min-h-[7.5rem] sm:min-h-[8.5rem]"
      : size === "sm"
        ? "min-h-[4.75rem] w-[8.5rem]"
        : "min-h-[5.5rem] w-[9.75rem] sm:w-[11rem]";

  return (
    <Link
      href={`/categories/${category.slug}`}
      className={cn(
        "group relative shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-[var(--slop-panel)] transition hover:border-[var(--slop-violet)]/45",
        dims,
        className,
      )}
    >
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--slop-violet)]/25 to-transparent" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />
      <div className="relative z-10 flex h-full flex-col justify-end p-3">
        <p className="font-display text-base font-bold tracking-tight text-white sm:text-lg">
          {category.name}
        </p>
        {typeof count === "number" ? (
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-white/45">
            {count} {count === 1 ? "show" : "shows"}
          </p>
        ) : (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-white/50">
            {category.description}
          </p>
        )}
      </div>
    </Link>
  );
}

export function genreCover(
  categoryId: string,
  dramas: Drama[],
  prefer: "poster" | "banner" = "poster",
): string | null {
  const matches = dramas.filter(
    (d) =>
      d.status === "published" &&
      d.genreIds.includes(categoryId) &&
      (d.bannerUrl || d.posterUrl),
  );
  if (matches.length === 0) return null;
  // Prefer a show where this genre is primary so tiles don't all share one art.
  const primary = matches.filter((d) => d.genreIds[0] === categoryId);
  const pool = primary.length > 0 ? primary : matches;
  const hash = [...categoryId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const pick = pool[hash % pool.length];
  if (prefer === "banner") {
    return pick.bannerUrl || pick.posterUrl || null;
  }
  return pick.posterUrl || pick.bannerUrl || null;
}

export function genreCount(categoryId: string, dramas: Drama[]): number {
  return dramas.filter(
    (d) => d.status === "published" && d.genreIds.includes(categoryId),
  ).length;
}
