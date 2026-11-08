import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-[var(--slop-slate)] outline-none focus-visible:border-[var(--slop-violet)]/60 focus-visible:ring-2 focus-visible:ring-[var(--slop-violet)]/20",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
