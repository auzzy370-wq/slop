"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    void (async () => {
      try {
        // Drop every old worker/cache — Safari was especially sticky with v1–v3.
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((k) => k.startsWith("slop-"))
              .map((k) => caches.delete(k)),
          );
        }
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        // Ignore registration failures in dev / unsupported contexts
      }
    })();
  }, []);
  return null;
}
