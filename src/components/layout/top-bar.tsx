"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSlopStore } from "@/store/slop-store";

const tabs = [
  { href: "/", label: "For You", section: "for-you" },
  { href: "/?feed=trending", label: "Trending", section: "trending" },
  { href: "/?feed=newest", label: "Newest", section: "newest" },
  { href: "/?feed=most-viewed", label: "Most Viewed", section: "most-viewed" },
];

export function TopBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useSlopStore((s) => s.currentUser);
  const feed = searchParams.get("feed") ?? "for-you";

  if (pathname !== "/") return null;

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40">
      <div className="pointer-events-auto mx-auto flex max-w-lg items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          href="/"
          className="font-display text-2xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
        >
          SLOP
          <span className="text-[var(--slop-violet)]">.</span>
        </Link>
        <div className="flex items-center gap-2">
          {user?.isPremium && (
            <span className="rounded-full border border-[var(--slop-violet)]/40 bg-[var(--slop-violet)]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--slop-violet)]">
              Premium
            </span>
          )}
        </div>
      </div>
      <div className="pointer-events-auto mx-auto flex max-w-lg gap-1 overflow-x-auto px-3 pb-2 scrollbar-none">
        {tabs.map((tab) => {
          const active = feed === tab.section;
          return (
            <Link
              key={tab.section}
              href={tab.href}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                active
                  ? "bg-white text-black shadow-lg"
                  : "bg-black/35 text-white/80 backdrop-blur-md hover:bg-black/50",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
