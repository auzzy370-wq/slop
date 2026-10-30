"use client";

import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * SLOP app mark — violet gradient tile + geometric S monogram.
 * Reads clearly on dark chrome (unlike the old dark-on-dark mark).
 */
export function SlopMark({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const bg = `slopMarkBg-${uid}`;
  const sheen = `slopMarkSheen-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-8 w-8", className)}
      aria-hidden
    >
      <defs>
        <linearGradient
          id={bg}
          x1="6"
          y1="2"
          x2="58"
          y2="62"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7A5CFF" />
          <stop offset="0.48" stopColor="#B99AFF" />
          <stop offset="1" stopColor="#E9DEFF" />
        </linearGradient>
        <linearGradient
          id={sheen}
          x1="14"
          y1="4"
          x2="36"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff" stopOpacity="0.38" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${bg})`} />
      <rect width="64" height="64" rx="16" fill={`url(#${sheen})`} />
      <path
        fill="#111116"
        d="M43.2 19.6c-2.2-3.5-6.1-5.6-11.4-5.6-8 0-14 4.9-14 12.1 0 5.4 2.9 8.8 9.8 11.2l6.5 2.2c3.5 1.2 5.1 2.6 5.1 5 0 3-2.7 4.9-6.8 4.9-3.9 0-6.9-1.5-9-4.4l-6.1 4.4c3.1 4.5 8.3 7 15 7 9 0 15.1-4.9 15.1-12.5 0-5.6-3.1-9.2-10.3-11.7l-6.2-2.1c-3.2-1.1-4.6-2.5-4.6-4.7 0-2.7 2.4-4.4 6-4.4 3.2 0 5.6 1.4 7.2 3.7l5.9-4.1z"
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
          x1="6"
          y1="2"
          x2="58"
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
        d="M42.5 20.2c-2.1-3.3-5.7-5.2-10.7-5.2-7.5 0-13.1 4.6-13.1 11.3 0 5 2.7 8.2 9.1 10.5l6.1 2.1c3.3 1.1 4.8 2.4 4.8 4.7 0 2.8-2.5 4.6-6.4 4.6-3.6 0-6.4-1.4-8.4-4.1l-5.7 4.1c2.9 4.2 7.8 6.5 14 6.5 8.4 0 14.1-4.6 14.1-11.7 0-5.2-2.9-8.6-9.6-11l-5.8-2c-3-1.1-4.3-2.3-4.3-4.4 0-2.5 2.2-4.1 5.6-4.1 3 0 5.2 1.3 6.7 3.5l5.6-3.8z"
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
        "inline-flex items-center gap-2.5 font-display text-[1.35rem] font-bold leading-none tracking-[-0.045em] text-white",
        className,
      )}
    >
      {showMark ? (
        <SlopMark
          className={cn(
            "h-8 w-8 shrink-0 drop-shadow-[0_2px_10px_rgba(140,110,255,0.45)]",
            markClassName,
          )}
        />
      ) : null}
      <span className="translate-y-px">
        SLOP
        <span className="sr-only"> — Stories That Keep You Watching</span>
      </span>
    </Link>
  );
}
