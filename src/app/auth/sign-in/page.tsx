"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlopWordmark } from "@/components/brand/logo";
import { useSlopStore } from "@/store/slop-store";
import { track } from "@/lib/analytics/client";
import { toast } from "sonner";

export default function SignInPage() {
  const router = useRouter();
  const signInLocal = useSlopStore((s) => s.signInLocal);
  const signInDemo = useSlopStore((s) => s.signInDemo);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextEmailError = !email.includes("@")
      ? "Enter a valid email address."
      : null;
    const nextPasswordError =
      password.length < 6 ? "Use a password with 6 or more characters." : null;
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) {
      toast.error("Fix the highlighted fields, then try again.");
      return;
    }
    signInLocal(email, email.split("@")[0]);
    const u = useSlopStore.getState().currentUser;
    void track("login", { userId: u?.id });
    toast.success("Signed in");
    router.push("/");
  };

  return (
    <div className="slop-cinematic flex min-h-[100dvh] items-center justify-center px-4 pb-24 pt-10">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[var(--slop-panel)] p-6 shadow-2xl">
        <SlopWordmark />
        <h1 className="mt-4 font-display text-3xl font-bold">Welcome Back</h1>
        <p className="mt-2 text-sm text-[var(--slop-slate)]">
          Guests can like and save on this device — sign in to keep them on your
          account.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="sign-in-email" className="text-xs font-semibold text-white/70">
              Email
            </label>
            <Input
              id="sign-in-email"
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
              aria-describedby={emailError ? "sign-in-email-error" : undefined}
            />
            {emailError ? (
              <p id="sign-in-email-error" className="text-xs text-red-300">
                {emailError}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="sign-in-password"
              className="text-xs font-semibold text-white/70"
            >
              Password
            </label>
            <Input
              id="sign-in-password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              autoComplete="current-password"
              required
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={
                passwordError ? "sign-in-password-error" : undefined
              }
            />
            {passwordError ? (
              <p id="sign-in-password-error" className="text-xs text-red-300">
                {passwordError}
              </p>
            ) : null}
          </div>
          <Button type="submit" className="w-full">
            Sign In
          </Button>
        </form>

        <div className="mt-4 space-y-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => {
              signInDemo(false);
              toast.success("Signed in as demo viewer");
              router.push("/");
            }}
          >
            Continue as Demo Viewer
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              signInDemo(true);
              toast.success("Signed in as admin");
              router.push("/admin");
            }}
          >
            Continue as Demo Admin
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-[var(--slop-slate)]">
          New here?{" "}
          <Link href="/auth/sign-up" className="text-[var(--slop-violet)]">
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-[var(--slop-slate)]">
          <Link href="/auth/reset">Forgot password?</Link>
        </p>
      </div>
    </div>
  );
}
