"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  BarChart3,
  Flag,
  FolderOpen,
  Gift,
  LayoutDashboard,
  Link2,
  Megaphone,
  Menu,
  Settings,
  Share2,
  Users,
  Video,
} from "lucide-react";
import { SlopWordmark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { useSlopStore } from "@/store/slop-store";

const nav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/ads", label: "Ads", icon: Megaphone },
  { href: "/admin/campaigns", label: "Campaigns", icon: Link2 },
  { href: "/admin/referrals", label: "Rewards", icon: Gift },
  { href: "/admin/videos", label: "Episodes", icon: Video },
  { href: "/admin/social", label: "Social", icon: Share2 },
  { href: "/admin/categories", label: "Categories", icon: FolderOpen },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const user = useSlopStore((s) => s.currentUser);
  const hydrated = useSlopStore((s) => s.hydrated);
  const pathname = usePathname();
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!user || user.role !== "admin") {
      router.replace("/auth/sign-in");
    }
  }, [hydrated, user, router]);

  // Keep the active section chip in view on mobile.
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [pathname]);

  if (!hydrated || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--slop-violet)]" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--slop-black)] pb-8 md:pb-0">
      {/* Mobile sticky admin menu — clears the notch / Dynamic Island */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(17,17,22,0.94)] backdrop-blur-xl md:hidden">
        <div className="px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Menu className="h-4 w-4 shrink-0 text-[var(--slop-violet)]" aria-hidden />
              <SlopWordmark className="text-lg" />
              <span className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                Admin
              </span>
            </div>
            <Link
              href="/"
              className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/70"
            >
              Exit
            </Link>
          </div>
          <nav
            ref={scrollerRef}
            aria-label="Admin sections"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none"
          >
            {nav.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  ref={active ? activeRef : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition",
                    active
                      ? "bg-[var(--slop-violet)] text-[var(--slop-black)]"
                      : "bg-white/10 text-white/75 ring-1 ring-inset ring-white/10",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-0 md:gap-6 md:px-4 md:py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="mb-6 flex items-center gap-2">
            <SlopWordmark className="text-xl" />
            <span className="text-xs font-medium text-white/40">Admin</span>
          </div>
          <nav className="space-y-1">
            {nav.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-[var(--slop-violet)] text-[var(--slop-black)]"
                      : "text-white/65 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/"
            className="mt-6 inline-flex text-xs font-semibold text-white/45 hover:text-white"
          >
            ← Back to app
          </Link>
        </aside>

        <div className="min-w-0 max-w-full flex-1 overflow-x-hidden px-4 py-5 md:px-0 md:py-0">
          {children}
        </div>
      </div>
    </div>
  );
}
