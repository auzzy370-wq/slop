"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSlopStore } from "@/store/slop-store";
import { track } from "@/lib/analytics/client";
import { toast } from "sonner";

export default function RewardsPage() {
  const user = useSlopStore((s) => s.currentUser);
  const [data, setData] = useState<{
    code: string | null;
    referralUrl: string | null;
    clicks: number;
    registrations: number;
    qualified: number;
    premium: number;
    conversionRate: number;
    rewards: {
      id: string;
      status: string;
      reason: string;
      meta: Record<string, unknown>;
    }[];
    rules: {
      id: string;
      label: string;
      threshold: number;
      triggerType: string;
      active: boolean;
    }[];
    settings: { minWatchMinutesForQualified: number };
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    const preferred = user.displayName.replace(/[^a-z0-9]/gi, "").toLowerCase();
    void fetch(
      `/api/referrals?userId=${encodeURIComponent(user.id)}&preferredCode=${encodeURIComponent(preferred)}`,
    )
      .then((r) => r.json())
      .then(setData);
  }, [user]);

  if (!user) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="font-display text-2xl">SLOP Rewards</h1>
        <p className="text-sm text-[var(--slop-slate)]">
          Sign in to get your referral link.
        </p>
        <Link href="/auth/sign-in" className="text-[var(--slop-violet)]">
          Sign in
        </Link>
      </div>
    );
  }

  const nextRule = data?.rules
    .filter((r) => r.active && r.triggerType === "qualified_free_count")
    .sort((a, b) => a.threshold - b.threshold)
    .find((r) => (data?.qualified ?? 0) < r.threshold);

  return (
    <div className="slop-cinematic min-h-[100dvh] px-4 pb-28 pt-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <Link href="/account" className="text-sm text-[var(--slop-violet)]">
            ← Account
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold">SLOP Rewards</h1>
          <p className="mt-2 text-sm text-[var(--slop-slate)]">
            Share your link. Friends must verify email and meet the watch
            milestone before you earn rewards — no reward for sign-ups alone.
          </p>
        </div>

        {data?.referralUrl && (
          <section className="rounded-2xl border border-white/10 bg-[var(--slop-panel)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--slop-slate)]">
              Your referral URL
            </p>
            <p className="mt-2 break-all text-sm text-[var(--slop-lavender)]">
              {data.referralUrl}
            </p>
            <p className="mt-1 text-xs text-[var(--slop-slate)]">
              Code: {data.code}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  await navigator.clipboard.writeText(data.referralUrl!);
                  void track("referral_link_copied", { userId: user.id });
                  toast.success("Link copied");
                }}
              >
                Copy link
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent("Watch short dramas on SLOP")}&url=${encodeURIComponent(data.referralUrl!)}`;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
              >
                Share on X
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.referralUrl!)}`;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
              >
                Facebook
              </Button>
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Clicks" value={data?.clicks ?? 0} />
          <Stat label="Registrations" value={data?.registrations ?? 0} />
          <Stat label="Qualified" value={data?.qualified ?? 0} />
          <Stat label="Premium refs" value={data?.premium ?? 0} />
        </div>

        <p className="text-sm text-white/70">
          Conversion rate:{" "}
          {((data?.conversionRate ?? 0) * 100).toFixed(1)}%
        </p>

        {nextRule && (
          <div className="rounded-2xl border border-[var(--slop-violet)]/30 bg-[var(--slop-violet)]/10 p-4">
            <p className="text-sm font-semibold">Next reward</p>
            <p className="mt-1 text-sm text-white/75">{nextRule.label}</p>
            <p className="mt-2 text-xs text-[var(--slop-lavender)]">
              {data?.qualified ?? 0} / {nextRule.threshold} qualified free
              referrals
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full bg-[var(--slop-violet)]"
                style={{
                  width: `${Math.min(
                    100,
                    ((data?.qualified ?? 0) / nextRule.threshold) * 100,
                  )}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-[var(--slop-slate)]">
              Qualification: email verified +{" "}
              {data?.settings.minWatchMinutesForQualified ?? 10} minutes watched.
            </p>
          </div>
        )}

        <section>
          <h2 className="mb-3 font-semibold">Your rewards</h2>
          <div className="space-y-2">
            {(data?.rewards ?? []).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium capitalize">{r.status}</p>
                  <p className="text-xs text-[var(--slop-slate)]">{r.reason}</p>
                </div>
                {r.status === "earned" && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await fetch("/api/referrals", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "redeem",
                          userId: user.id,
                          rewardId: r.id,
                        }),
                      });
                      toast.success("Reward redeemed");
                      const refreshed = await fetch(
                        `/api/referrals?userId=${encodeURIComponent(user.id)}`,
                      ).then((x) => x.json());
                      setData(refreshed);
                    }}
                  >
                    Redeem
                  </Button>
                )}
              </div>
            ))}
            {(data?.rewards ?? []).length === 0 && (
              <p className="text-sm text-[var(--slop-slate)]">
                No rewards yet — share your link to get started.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--slop-panel)] p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-[var(--slop-slate)]">{label}</p>
    </div>
  );
}
