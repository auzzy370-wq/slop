import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-24 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-[var(--slop-slate)] outline-none focus-visible:border-[var(--slop-violet)]/60 focus-visible:ring-2 focus-visible:ring-[var(--slop-violet)]/20",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
