"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  placement = "auto",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  /** auto: bottom on mobile, centered on desktop. bottom: always a bottom sheet. */
  placement?: "auto" | "bottom";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const bottomSheet = placement === "bottom";

  return (
    <div
      className={cn(
        "fixed inset-0 z-[80] flex justify-center",
        bottomSheet ? "items-end" : "items-end sm:items-center",
      )}
    >
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 w-full max-w-lg overscroll-contain border border-white/10 bg-[var(--slop-panel)] p-5 shadow-2xl",
          bottomSheet
            ? "rounded-t-3xl sm:max-w-md"
            : "rounded-t-3xl sm:rounded-3xl",
          "animate-in-up",
          className,
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl tracking-tight text-white">
            {title}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
