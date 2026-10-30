"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";

export function AdSlot({ index }: { index: number }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_#1c1630_0%,_#111116_55%)] px-6 text-center">
      <div className="absolute left-4 top-4 rounded-md border border-white/20 bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
        Advertisement
      </div>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--slop-violet)]/15 text-[var(--slop-violet)]">
        <Megaphone className="h-7 w-7" />
      </div>
      <p className="mb-2 font-display text-2xl text-white">
        Keep watching without ads
      </p>
      <p className="mb-6 max-w-sm text-sm text-white/65">
        Free viewers see sponsored placements between episodes (#{index + 1}).
        Premium removes them completely.
      </p>
      <Link
        href="/premium"
        className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--slop-violet)] px-5 text-sm font-semibold text-[var(--slop-black)] transition hover:brightness-110"
      >
        Go ad-free for $7.99/mo
      </Link>
      <p className="mt-4 text-[11px] text-white/40">
        Demo placement — connect your ad network when approved.
      </p>
    </div>
  );
}
