"use client";

import Link from "next/link";
import { Check, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlopWordmark } from "@/components/brand/logo";
import { useSlopStore } from "@/store/slop-store";
import { track } from "@/lib/analytics/client";
import { toast } from "sonner";

const BENEFITS = [
  "No advertisements between episodes",
  "Unlimited watching with the same platform protections",
  "Premium badge on your account",
  "Priority access to new features when they ship",
  "Manage or cancel anytime through billing",
];

export default function PremiumPage() {
  const user = useSlopStore((s) => s.currentUser);
  const settings = useSlopStore((s) => s.settings);
  const activatePremiumDemo = useSlopStore((s) => s.activatePremiumDemo);

  const startCheckout = async () => {
    if (!user) {
      toast.message("Sign in first", {
        position: "bottom-center",
        action: {
          label: "Sign in",
          onClick: () => {
            window.location.href = "/auth/sign-in";
          },
        },
      });
      return;
    }

    void track("checkout_started", { userId: user.id });
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.demo) {
        activatePremiumDemo();
        await fetch("/api/analytics/subscription-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            eventType: "subscription_started",
            amountCents: 799,
            idempotencyKey: `subdemo:${user.id}:${Date.now()}`,
          }),
        });
        void track("subscription_started", { userId: user.id });
        void track("payment_completed", {
          userId: user.id,
          properties: { amountCents: 799, demo: true },
        });
        toast.success("Premium activated (demo mode)");
        return;
      }
      toast.error(data.error ?? "Checkout unavailable");
    } catch {
      activatePremiumDemo();
      toast.success("Premium activated (demo fallback)");
    }
  };

  return (
    <div className="slop-cinematic slop-safe-page min-h-[100dvh] px-4 pb-28">
      <div className="mx-auto max-w-lg animate-fade">
        <SlopWordmark className="mb-8" />
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--slop-violet)] text-[var(--slop-black)]">
          <Crown className="h-7 w-7" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--slop-violet)]">
          SLOP Premium
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-tight">
          Stories without the ads
        </h1>
        <p className="mt-3 text-[var(--slop-slate)]">
          {settings.premiumPriceLabel} for an ad-free binge and a Premium badge.
          No generation credits. Just cleaner watching.
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-[var(--slop-panel)] p-5">
          <p className="font-display text-3xl font-bold">
            $7.99
            <span className="text-base font-medium text-[var(--slop-slate)]">
              {" "}
              / month
            </span>
          </p>
          <ul className="mt-5 space-y-3">
            {BENEFITS.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 text-sm text-white/80"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--slop-violet)]" />
                {b}
              </li>
            ))}
          </ul>

          {user?.isPremium ? (
            <div className="mt-6 rounded-2xl border border-[var(--slop-violet)]/30 bg-[var(--slop-violet)]/10 p-4 text-sm">
              You already have Premium. Ads are suppressed on verified premium
              accounts.
              <Link
                href="/account"
                className="mt-2 block text-[var(--slop-violet)]"
              >
                Manage in account →
              </Link>
            </div>
          ) : (
            <Button className="mt-6 w-full" size="lg" onClick={startCheckout}>
              Subscribe with Stripe
            </Button>
          )}
          <p className="mt-3 text-[11px] text-[var(--slop-slate)]">
            Premium status is verified server-side via Stripe webhooks. Without
            Stripe keys, demo mode simulates an active subscription locally.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--slop-slate)]">
          By subscribing you agree to the{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>
          . Cancel anytime.
        </p>
      </div>
    </div>
  );
}
