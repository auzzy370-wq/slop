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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || password.length < 6) {
      toast.error("Enter a valid email and password (6+ chars).");
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
        <h1 className="mt-4 font-display text-3xl font-bold">Welcome back</h1>
        <p className="mt-2 text-sm text-[var(--slop-slate)]">
          Guests can like and save on this device — sign in to keep them on your
          account.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <Button type="submit" className="w-full">
            Sign in
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
            Continue as demo viewer
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
            Continue as demo admin
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
