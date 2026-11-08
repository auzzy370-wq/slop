"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSlopStore } from "@/store/slop-store";
import {
  getSessionId,
  getStoredReferralCode,
  track,
} from "@/lib/analytics/client";
import { toast } from "sonner";

export default function SignUpPage() {
  const router = useRouter();
  const signInLocal = useSlopStore((s) => s.signInLocal);
  const settings = useSlopStore((s) => s.settings);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!settings.registrationEnabled) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-4 text-center">
        <div>
          <h1 className="font-display text-2xl">Registration Paused</h1>
          <p className="mt-2 text-sm text-white/55">
            New accounts are temporarily disabled.
          </p>
          <Link href="/" className="mt-4 inline-block text-[var(--slop-violet)]">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextNameError = !displayName.trim()
      ? "Enter a display name."
      : null;
    const nextEmailError = !email.includes("@")
      ? "Enter a valid email address."
      : null;
    const nextPasswordError =
      password.length < 6 ? "Use a password with 6 or more characters." : null;
    setNameError(nextNameError);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextNameError || nextEmailError || nextPasswordError) {
      toast.error("Fix the highlighted fields, then try again.");
      return;
    }
    void track("registration_started");
    signInLocal(email, displayName.trim());
    const created = useSlopStore.getState().currentUser;
    if (created) {
      await track("registration_completed", {
        userId: created.id,
        idempotencyKey: `reg:${created.id}`,
        properties: { emailDomain: email.split("@")[1] },
      });
      await track("profile_created", { userId: created.id });
      const code = getStoredReferralCode();
      await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          code,
          referredUserId: created.id,
          sessionId: getSessionId(),
          emailVerified: false,
        }),
      });
      // Demo: offer immediate email verify button via toast action path
      await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_email",
          userId: created.id,
        }),
      });
      await ensureReferralForUser(created.id, displayName);
    }
    toast.success("Account created");
    router.push("/");
  };

  return (
    <div className="slop-cinematic flex min-h-[100dvh] items-center justify-center px-4 pb-24 pt-10">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[var(--slop-panel)] p-6">
        <h1 className="font-display text-3xl font-bold">Join SLOP</h1>
        <p className="mt-2 text-sm text-white/55">
          Create an account to keep guest likes and saves, plus comments,
          reports, and SLOP Rewards.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="sign-up-name"
              className="text-xs font-semibold text-white/70"
            >
              Display Name
            </label>
            <Input
              id="sign-up-name"
              name="displayName"
              placeholder="Alex…"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (nameError) setNameError(null);
              }}
              autoComplete="nickname"
              spellCheck={false}
              required
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "sign-up-name-error" : undefined}
            />
            {nameError ? (
              <p id="sign-up-name-error" className="text-xs text-red-300">
                {nameError}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="sign-up-email"
              className="text-xs font-semibold text-white/70"
            >
              Email
            </label>
            <Input
              id="sign-up-email"
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
              aria-describedby={emailError ? "sign-up-email-error" : undefined}
            />
            {emailError ? (
              <p id="sign-up-email-error" className="text-xs text-red-300">
                {emailError}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="sign-up-password"
              className="text-xs font-semibold text-white/70"
            >
              Password
            </label>
            <Input
              id="sign-up-password"
              name="password"
              type="password"
              placeholder="At least 6 characters…"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              autoComplete="new-password"
              required
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={
                passwordError ? "sign-up-password-error" : undefined
              }
            />
            {passwordError ? (
              <p id="sign-up-password-error" className="text-xs text-red-300">
                {passwordError}
              </p>
            ) : null}
          </div>
          <Button type="submit" className="w-full">
            Create Account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-white/50">
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="text-[var(--slop-violet)]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

async function ensureReferralForUser(userId: string, displayName: string) {
  const preferred = displayName.replace(/[^a-z0-9]/gi, "").toLowerCase();
  await fetch(
    `/api/referrals?userId=${encodeURIComponent(userId)}&preferredCode=${encodeURIComponent(preferred)}`,
  );
}
