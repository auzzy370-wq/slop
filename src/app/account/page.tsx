"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSlopStore } from "@/store/slop-store";
import { toast } from "sonner";

export default function AccountPage() {
  const router = useRouter();
  const user = useSlopStore((s) => s.currentUser);
  const subscription = useSlopStore((s) => s.subscription);
  const saves = useSlopStore((s) => s.saves);
  const updateProfile = useSlopStore((s) => s.updateProfile);
  const signOut = useSlopStore((s) => s.signOut);
  const requestDeletion = useSlopStore((s) => s.requestDeletion);
  const cancelPremiumDemo = useSlopStore((s) => s.cancelPremiumDemo);
  const [name, setName] = useState(user?.displayName ?? "");

  if (!user) {
    return (
      <div className="slop-grid-bg flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4 pb-24 text-center">
        <h1 className="font-display text-3xl font-bold">
          Your account
        </h1>
        <p className="max-w-sm text-sm text-white/55">
          Sign in to manage likes, saves, comments, premium, and deletion requests.
        </p>
        <div className="flex gap-2">
          <Link
            href="/auth/sign-in"
            className="inline-flex h-11 items-center rounded-xl bg-[var(--slop-violet)] px-5 text-sm font-semibold text-[var(--slop-ink)]"
          >
            Sign in
          </Link>
          <Link
            href="/auth/sign-up"
            className="inline-flex h-11 items-center rounded-xl border border-white/15 px-5 text-sm font-semibold"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const savedCount = saves.filter((s) => s.userId === user.id).length;

  return (
    <div className="slop-grid-bg min-h-[100dvh] px-4 pb-28 pt-8 lg:pb-16 lg:pt-24">
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--slop-violet)]">
            Account
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold">
            {user.displayName}
          </h1>
          <p className="text-sm text-white/50">{user.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {user.isPremium && (
              <span className="rounded-full bg-[var(--slop-violet)]/15 px-3 py-1 text-xs font-bold text-[var(--slop-violet)]">
                Premium
              </span>
            )}
            {user.role === "admin" && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
                Admin
              </span>
            )}
            {user.status === "pending_deletion" && (
              <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-300">
                Deletion requested
              </span>
            )}
          </div>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/45">
            Profile
          </h2>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name"
            />
            <Button
              onClick={() => {
                if (!name.trim()) return;
                updateProfile({ displayName: name.trim() });
                toast.success("Profile updated");
              }}
            >
              Save
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Link
            href="/saved"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <p className="text-2xl font-bold">{savedCount}</p>
            <p className="text-xs text-white/50">Saved videos</p>
          </Link>
          <Link
            href="/premium"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <p className="text-2xl font-bold">{user.isPremium ? "On" : "Off"}</p>
            <p className="text-xs text-white/50">Premium</p>
          </Link>
        </section>

        <Link
          href="/account/rewards"
          className="block rounded-2xl border border-[var(--slop-violet)]/30 bg-[var(--slop-violet)]/10 p-4 text-sm font-semibold text-[var(--slop-lavender)]"
        >
          SLOP Rewards — share & earn →
        </Link>

        {subscription && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <h2 className="mb-2 font-semibold">Subscription</h2>
            <p className="text-white/60">Status: {subscription.status}</p>
            {subscription.currentPeriodEnd && (
              <p className="text-white/60">
                Period ends:{" "}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
            {user.isPremium && (
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => {
                  cancelPremiumDemo();
                  toast.message("Premium canceled at period end (demo)");
                }}
              >
                Cancel premium
              </Button>
            )}
          </section>
        )}

        {user.role === "admin" && (
          <Link
            href="/admin"
            className="block rounded-2xl border border-[var(--slop-violet)]/30 bg-[var(--slop-violet)]/10 p-4 text-sm font-semibold text-[var(--slop-violet)]"
          >
            Open admin dashboard →
          </Link>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              signOut();
              toast.success("Signed out");
              router.push("/");
            }}
          >
            Sign out
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              requestDeletion();
              toast.message("Account deletion requested", {
                description: "In production this queues secure erasure workflows.",
              });
            }}
          >
            Request account deletion
          </Button>
        </div>

        <p className="text-xs text-white/35">
          See our{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
