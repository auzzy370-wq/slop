import Link from "next/link";
import { cn } from "@/lib/utils";

export function SlopMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-8 w-8", className)}
      aria-hidden
    >
      <rect width="64" height="64" rx="14" fill="#111116" />
      <path
        d="M41 18.5c-2.25-3.5-6-5.5-11-5.5-7.75 0-13.5 5-13.5 12.25 0 5.5 3 9 9.75 11.5l5.25 2c3.5 1.25 5.25 2.75 5.25 5.25 0 3.25-2.75 5.25-7 5.25-3.75 0-6.75-1.5-8.75-4.5l-5.5 4.5C18 54.5 23.25 57.25 29.5 57.25c8.75 0 14.75-5 14.75-12.75 0-5.75-3.25-9.5-10.5-12l-5-1.75c-3.25-1.25-4.75-2.75-4.75-5 0-3 2.5-4.75 6.25-4.75 3.25 0 5.75 1.5 7.25 4l5.5-4.25z"
        fill="#B99AFF"
      />
    </svg>
  );
}

export function SlopWordmark({
  href = "/",
  className,
  showDot = true,
}: {
  href?: string;
  className?: string;
  showDot?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-white",
        className,
      )}
    >
      <SlopMark className="h-8 w-8 shrink-0" />
      <span>
        SLOP
        {showDot ? <span className="text-[var(--slop-violet)]">.</span> : null}
      </span>
    </Link>
  );
}
