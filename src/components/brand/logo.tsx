"use client";

import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/utils";

/** Bold S path drawn around origin (0,0) for easy centering. */
const S_PATH =
  "M12.4-14.8c-2.3-3.55-6.25-5.7-11.55-5.7-8.1 0-14.15 4.95-14.15 12.2 0 5.45 2.95 8.85 9.9 11.3l6.55 2.2c3.55 1.2 5.15 2.6 5.15 5.05 0 3.05-2.75 4.95-6.9 4.95-3.95 0-7-1.5-9.1-4.45l-6.2 4.45c3.15 4.55 8.4 7.05 15.15 7.05 9.05 0 15.25-4.95 15.25-12.55 0-5.65-3.15-9.25-10.4-11.75l-6.3-2.15c-3.25-1.1-4.65-2.5-4.65-4.75 0-2.75 2.4-4.45 6.05-4.45 3.25 0 5.65 1.4 7.25 3.7l6-4.05z";

/**
 * Rounded dark tile + lavender S — horizontal lockup mark (no speech bubble).
 */
export function SlopMark({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const bg = `slopBg-${uid}`;
  const letter = `slopLetter-${uid}`;

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
          y1="4"
          x2="56"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#1A1528" />
          <stop offset="1" stopColor="#0E0C14" />
        </linearGradient>
        <linearGradient
          id={letter}
          x1="18"
          y1="12"
          x2="46"
          y2="52"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#E9DEFF" />
          <stop offset="0.55" stopColor="#B99AFF" />
          <stop offset="1" stopColor="#9B7AFF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${bg})`} />
      <rect
        x="1.25"
        y="1.25"
        width="61.5"
        height="61.5"
        rx="14.75"
        fill="none"
        stroke="rgba(185,154,255,0.28)"
        strokeWidth="1.5"
      />
      <path d={S_PATH} fill={`url(#${letter})`} transform="translate(32 30.8)" />
    </svg>
  );
}

export function SlopMarkMini({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const bg = `slopMiniBg-${uid}`;
  const letter = `slopMiniLetter-${uid}`;

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
          y1="4"
          x2="56"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#1A1528" />
          <stop offset="1" stopColor="#0E0C14" />
        </linearGradient>
        <linearGradient
          id={letter}
          x1="18"
          y1="12"
          x2="46"
          y2="52"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#E9DEFF" />
          <stop offset="1" stopColor="#B99AFF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${bg})`} />
      <path d={S_PATH} fill={`url(#${letter})`} transform="translate(32 30.8)" />
    </svg>
  );
}

/**
 * Horizontal lockup: rounded S tile + lavender SLOP wordmark (no chat bubble).
 */
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
        "inline-flex h-9 items-center gap-2.5 font-display text-[1.35rem] font-bold leading-none tracking-[-0.03em] text-[var(--slop-lavender)]",
        className,
      )}
    >
      {showMark ? (
        <SlopMark
          className={cn(
            "h-8 w-8 shrink-0",
            markClassName,
          )}
        />
      ) : null}
      <span className="leading-none">SLOP</span>
      <span className="sr-only"> — Stories That Keep You Watching</span>
    </Link>
  );
}
