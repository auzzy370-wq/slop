"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BarChart3,
  Flag,
  FolderOpen,
  Gift,
  LayoutDashboard,
  Link2,
  Settings,
  Users,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSlopStore } from "@/store/slop-store";

const nav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/campaigns", label: "Campaigns", icon: Link2 },
  { href: "/admin/referrals", label: "Rewards", icon: Gift },
  { href: "/admin/videos", label: "Episodes", icon: Video },
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

  useEffect(() => {
    if (!hydrated) return;
    if (!user || user.role !== "admin") {
      router.replace("/auth/sign-in");
    }
  }, [hydrated, user, router]);

  if (!hydrated || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--slop-violet)]" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--slop-black)] pb-16 md:pb-0">
      <div className="mx-auto flex max-w-6xl gap-0 md:gap-6 md:px-4 md:py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <Link
            href="/"
            className="mb-6 block font-display text-2xl font-bold"
          >
            SLOP<span className="text-[var(--slop-violet)]">.</span>
            <span className="ml-2 text-xs font-medium text-white/40">Admin</span>
          </Link>
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
        </aside>

        <div className="min-w-0 flex-1 px-4 py-6 md:px-0 md:py-0">
          <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
            {nav.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
                  pathname === href || (href !== "/admin" && pathname.startsWith(href))
                    ? "bg-white text-black"
                    : "bg-white/10 text-white/70",
                )}
              >
                {label}
              </Link>
            ))}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
