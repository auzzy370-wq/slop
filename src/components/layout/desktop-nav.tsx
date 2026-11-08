"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clapperboard,
  Compass,
  Crown,
  Home,
  Search,
  UserRound,
} from "lucide-react";
import { SlopWordmark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { useSlopStore } from "@/store/slop-store";

const items = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/watch",
    label: "Watch",
    icon: Clapperboard,
    match: (p: string) => p.startsWith("/watch") || p.startsWith("/v/"),
  },
  {
    href: "/explore",
    label: "Explore",
    icon: Compass,
    match: (p: string) =>
      p.startsWith("/explore") ||
      p.startsWith("/categories") ||
      p.startsWith("/search") ||
      p.startsWith("/drama"),
  },
  {
    href: "/premium",
    label: "Premium",
    icon: Crown,
    match: (p: string) => p.startsWith("/premium"),
  },
  {
    href: "/account",
    label: "Account",
    icon: UserRound,
    match: (p: string) => p.startsWith("/account"),
  },
];

export function DesktopNav() {
  const pathname = usePathname();
  const user = useSlopStore((s) => s.currentUser);

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth")
  ) {
    return null;
  }

  const immersive =
    pathname.startsWith("/watch") || pathname.startsWith("/v/");

  return (
    <header
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50 hidden lg:block",
        immersive && "lg:bg-transparent",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-6",
          !immersive &&
            "border-b border-white/5 bg-[rgba(17,17,22,0.88)] backdrop-blur-xl",
          immersive && "bg-gradient-to-b from-black/70 to-transparent",
        )}
      >
        <SlopWordmark className="shrink-0" markClassName="h-7 w-7" />

        <nav className="flex flex-1 items-center gap-1">
          {items.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/55 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {user?.isPremium && (
            <span className="rounded-full border border-[var(--slop-violet)]/40 bg-[var(--slop-violet)]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--slop-lavender)]">
              Premium
            </span>
          )}
          <Link
            href="/search"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <Search className="h-4 w-4" />
            Search
          </Link>
        </div>
      </div>
    </header>
  );
}
