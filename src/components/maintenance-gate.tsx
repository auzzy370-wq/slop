"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { SlopWordmark } from "@/components/brand/logo";
import { useSlopStore } from "@/store/slop-store";

type Status = {
  maintenanceMode: boolean;
  maintenanceMessage: string;
};

/**
 * When maintenance mode is on (server flag), block the public site.
 * Admins and /admin /auth routes stay available.
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const user = useSlopStore((s) => s.currentUser);
  const hydrated = useSlopStore((s) => s.hydrated);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/site/status", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as Status;
        if (!cancelled) {
          setStatus({
            maintenanceMode: Boolean(data.maintenanceMode),
            maintenanceMessage:
              data.maintenanceMessage ||
              "SLOP is temporarily down for maintenance. We’ll be back shortly.",
          });
        }
      } catch {
        if (!cancelled) {
          setStatus({ maintenanceMode: false, maintenanceMessage: "" });
        }
      }
    };
    void load();
    const id = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const isAdminPath =
    pathname.startsWith("/admin") || pathname.startsWith("/auth");
  const isAdminUser = hydrated && user?.role === "admin";
  const blocking =
    Boolean(status?.maintenanceMode) && !isAdminPath && !isAdminUser;

  if (blocking) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--slop-black)] px-6 text-center">
        <SlopWordmark className="text-3xl" />
        <h1 className="mt-6 font-display text-3xl font-bold text-white">
          Under maintenance
        </h1>
        <p className="mt-3 max-w-md text-sm text-white/60">
          {status?.maintenanceMessage}
        </p>
        <Link
          href="/auth/sign-in"
          className="mt-8 text-sm font-semibold text-[var(--slop-violet)] hover:underline"
        >
          Admin sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      {status?.maintenanceMode && isAdminUser && !pathname.startsWith("/admin") ? (
        <div className="sticky top-0 z-[80] border-b border-amber-400/30 bg-amber-400/15 px-3 py-2 text-center text-xs text-amber-50">
          Maintenance mode is ON — visitors see a downtime page.{" "}
          <Link href="/admin/settings" className="font-semibold underline">
            Turn it off in Settings
          </Link>
        </div>
      ) : null}
      {children}
    </>
  );
}
