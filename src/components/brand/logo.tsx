"use client";

import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * SLOP brand mark — vertical short-drama frame + play.
 * Geometry is fill-based and optically centered in the tile.
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
          x1="10"
          y1="2"
          x2="54"
          y2="62"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#5B3DFF" />
          <stop offset="0.5" stopColor="#A78BFA" />
          <stop offset="1" stopColor="#EDE4FF" />
        </linearGradient>
        <linearGradient
          id={sheen}
          x1="14"
          y1="4"
          x2="38"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="16" fill={`url(#${bg})`} />
      <rect width="64" height="64" rx="16" fill={`url(#${sheen})`} />

      {/* Outer phone bezel — center x=32 */}
      <rect x="19" y="11" width="26" height="42" rx="7" fill="#111116" />
      {/* Inner screen */}
      <rect x="23" y="16" width="18" height="32" rx="3.5" fill="#1A1528" />
      {/* Screen highlight */}
      <rect x="23" y="16" width="18" height="10" rx="3.5" fill="#2A2140" opacity="0.55" />
      {/* Play — tip slightly past center for optical balance */}
      <path d="M27.6 26.4v15.2L41 34 27.6 26.4z" fill="#F3ECFF" />
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
          x1="10"
          y1="2"
          x2="54"
          y2="62"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#5B3DFF" />
          <stop offset="1" stopColor="#C4B0FF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${bg})`} />
      <rect x="19" y="11" width="26" height="42" rx="7" fill="#111116" />
      <rect x="23" y="16" width="18" height="32" rx="3.5" fill="#1A1528" />
      <path d="M27.6 26.4v15.2L41 34 27.6 26.4z" fill="#F3ECFF" />
    </svg>
  );
}

/** Custom wordmark — signature play-O, not system type. */
function SlopLetters({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 124 28"
      className={cn("h-[1.05em] w-auto", className)}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M23.2 5.9c-1.55-2.15-4.2-3.45-7.55-3.45-5.25 0-9.15 3-9.15 7.4 0 3.4 1.85 5.45 6.35 7l4.2 1.45c2.35.8 3.35 1.65 3.35 3.15 0 1.95-1.75 3.15-4.5 3.15-2.55 0-4.5-.95-5.95-2.85l-4 2.85c2.05 2.95 5.45 4.55 9.85 4.55 5.85 0 9.85-3.15 9.85-8.05 0-3.55-1.95-5.9-6.65-7.55l-4-1.35c-2.05-.7-2.95-1.55-2.95-3 0-1.7 1.55-2.75 3.9-2.75 2.05 0 3.6.85 4.6 2.35l3.9-2.75z"
      />
      <path fill="currentColor" d="M36.4 2.8h4.35v18.6h10.9v3.7H36.4V2.8z" />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M68.2 1.2c-7.4 0-12.95 5.5-12.95 12.7S60.8 26.6 68.2 26.6s12.95-5.5 12.95-12.7S75.6 1.2 68.2 1.2zm0 3.8c5.05 0 8.55 3.7 8.55 8.9s-3.5 8.9-8.55 8.9-8.55-3.7-8.55-8.9 3.5-8.9 8.55-8.9z"
      />
      <path fill="currentColor" d="M64.9 9.7v11l9.1-5.5-9.1-5.5z" />
      <path
        fill="currentColor"
        d="M87 2.8h8.7c5.7 0 9.4 3.4 9.4 8.6 0 5.2-3.7 8.6-9.4 8.6H91.4V25.1H87V2.8zm4.35 3.7v9.85h4.15c3.2 0 5.05-1.75 5.05-4.9s-1.85-4.95-5.05-4.95h-4.15z"
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
      className={cn("inline-flex h-9 items-center gap-2.5 text-white", className)}
    >
      {showMark ? (
        <SlopMark
          className={cn(
            "h-9 w-9 shrink-0 drop-shadow-[0_4px_16px_rgba(91,61,255,0.5)]",
            markClassName,
          )}
        />
      ) : null}
      <SlopLetters className="h-[21px] translate-y-[0.5px] text-white" />
      <span className="sr-only">SLOP — Stories That Keep You Watching</span>
    </Link>
  );
}
