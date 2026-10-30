"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Bust the old cache-first worker that was serving stale shells / 404 media.
    void navigator.serviceWorker
      .getRegistrations()
      .then((regs) =>
        Promise.all(
          regs.map(async (reg) => {
            await reg.update();
            return reg;
          }),
        ),
      )
      .then(() => navigator.serviceWorker.register("/sw.js"))
      .catch(() => {
        // Ignore registration failures in dev / unsupported contexts
      });
  }, []);
  return null;
}
