"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  return (
    <div className="slop-grid-bg flex min-h-[100dvh] items-center justify-center px-4 pb-24">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[var(--slop-panel)] p-6">
        <h1 className="font-display text-3xl font-bold">Reset Password</h1>
        <p className="mt-2 text-sm text-white/55">
          When Supabase Auth is connected, a reset link is emailed securely. In
          demo mode we only validate the address.
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.includes("@")) {
              setEmailError("Enter a valid email address.");
              toast.error("Enter a valid email, then try again.");
              return;
            }
            setEmailError(null);
            toast.success("If an account exists, a reset email would be sent.");
          }}
        >
          <div className="space-y-1.5">
            <label
              htmlFor="reset-email"
              className="text-xs font-semibold text-white/70"
            >
              Email
            </label>
            <Input
              id="reset-email"
              name="email"
              type="email"
              inputMode="email"
              placeholder="you@example.com…"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              autoComplete="email"
              spellCheck={false}
              required
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "reset-email-error" : undefined}
            />
            {emailError ? (
              <p id="reset-email-error" className="text-xs text-red-300">
                {emailError}
              </p>
            ) : null}
          </div>
          <Button type="submit" className="w-full">
            Send Reset Link
          </Button>
        </form>
        <Link
          href="/auth/sign-in"
          className="mt-4 inline-block text-sm text-[var(--slop-violet)]"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
