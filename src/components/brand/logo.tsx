"use client";

import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * SLOP mark — violet gradient tile + centered geometric S.
 * Restored after the frame/play experiment; optically centered.
 */
export function SlopMark({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const bg = `slopBg-${uid}`;
  const sheen = `slopSheen-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-8 w-8", className)}
      aria-hidden
    >
      <defs>
        <linearGradient
          id={bg}
          x1="8"
          y1="2"
          x2="56"
          y2="62"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7A5CFF" />
          <stop offset="0.5" stopColor="#B99AFF" />
          <stop offset="1" stopColor="#E9DEFF" />
        </linearGradient>
        <linearGradient
          id={sheen}
          x1="14"
          y1="4"
          x2="36"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${bg})`} />
      <rect width="64" height="64" rx="16" fill={`url(#${sheen})`} />
      {/* Geometric S — shifted to optical center of the tile */}
      <path
        fill="#111116"
        transform="translate(1.2 0)"
        d="M42.6 19.8c-2.15-3.4-5.9-5.45-11-5.45-7.7 0-13.5 4.7-13.5 11.65 0 5.2 2.8 8.45 9.45 10.8l6.25 2.1c3.4 1.15 4.9 2.5 4.9 4.85 0 2.9-2.6 4.7-6.55 4.7-3.75 0-6.65-1.45-8.65-4.25l-5.9 4.25c3 4.35 8 6.75 14.45 6.75 8.65 0 14.55-4.7 14.55-12 0-5.4-3-8.85-9.9-11.25l-6-2.05c-3.1-1.05-4.45-2.4-4.45-4.55 0-2.6 2.3-4.25 5.8-4.25 3.1 0 5.4 1.35 6.95 3.55l5.7-4z"
      />
    </svg>
  );
}

export function SlopMarkMini({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const bg = `slopMiniBg-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-4 w-4", className)}
      aria-hidden
    >
      <defs>
        <linearGradient
          id={bg}
          x1="8"
          y1="2"
          x2="56"
          y2="62"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7A5CFF" />
          <stop offset="1" stopColor="#C9B4FF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${bg})`} />
      <path
        fill="#111116"
        transform="translate(1.2 0)"
        d="M42.6 19.8c-2.15-3.4-5.9-5.45-11-5.45-7.7 0-13.5 4.7-13.5 11.65 0 5.2 2.8 8.45 9.45 10.8l6.25 2.1c3.4 1.15 4.9 2.5 4.9 4.85 0 2.9-2.6 4.7-6.55 4.7-3.75 0-6.65-1.45-8.65-4.25l-5.9 4.25c3 4.35 8 6.75 14.45 6.75 8.65 0 14.55-4.7 14.55-12 0-5.4-3-8.85-9.9-11.25l-6-2.05c-3.1-1.05-4.45-2.4-4.45-4.55 0-2.6 2.3-4.25 5.8-4.25 3.1 0 5.4 1.35 6.95 3.55l5.7-4z"
      />
    </svg>
  );
}

export function SlopWordmark({
  href = "/",
  className,
  markClassName,
  showMark = true,
}: {
  href?: string;
  className?: string;
  markClassName?: string;
  showMark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center gap-2.5 font-display text-[1.35rem] font-bold leading-none tracking-[-0.04em] text-white",
        className,
      )}
    >
      {showMark ? (
        <SlopMark
          className={cn(
            "h-8 w-8 shrink-0 drop-shadow-[0_2px_10px_rgba(140,110,255,0.4)]",
            markClassName,
          )}
        />
      ) : null}
      <span className="translate-y-px">SLOP</span>
      <span className="sr-only"> — Stories That Keep You Watching</span>
    </Link>
  );
}
