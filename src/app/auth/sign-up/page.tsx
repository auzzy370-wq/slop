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

  if (!settings.registrationEnabled) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-4 text-center">
        <div>
          <h1 className="font-display text-2xl">Registration paused</h1>
          <p className="mt-2 text-sm text-white/55">
            New accounts are temporarily disabled.
          </p>
          <Link href="/" className="mt-4 inline-block text-[var(--slop-violet)]">
            Back to feed
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || password.length < 6 || !displayName.trim()) {
      toast.error("Fill in display name, email, and a 6+ character password.");
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
          Optional account for likes, saves, comments, reports, and SLOP Rewards.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <Input
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" className="w-full">
            Create account
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
