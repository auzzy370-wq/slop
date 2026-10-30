"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/admin/date-range-filter";
import { useSlopStore } from "@/store/slop-store";
import { toast } from "sonner";

export default function AdminReferralsPage() {
  const user = useSlopStore((s) => s.currentUser);
  const [data, setData] = useState<{
    totals: Record<string, number>;
    rules: {
      id: string;
      key: string;
      label: string;
      threshold: number;
      active: boolean;
      triggerType: string;
    }[];
    settings: {
      attributionWindowDays: number;
      minWatchMinutesForQualified: number;
      requireEmailVerification: boolean;
      referralEnabled: boolean;
    };
    relationships: {
      id: string;
      referrerUserId: string;
      referredUserId: string;
      code: string;
      status: string;
      flags: string[];
      watchMinutes: number;
      emailVerified: boolean;
    }[];
    rewards: {
      id: string;
      userId: string;
      status: string;
      reason: string;
      idempotencyKey: string;
    }[];
    suspicious: unknown[];
    topReferrers: { userId: string; count: number; premium: number }[];
  } | null>(null);

  const load = async () => {
    const res = await fetch("/api/referrals", { method: "PUT" });
    setData(await res.json());
  };

  useEffect(() => {
    void load();
  }, []);

  if (!data) {
    return <p className="text-sm text-[var(--slop-slate)]">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">SLOP Rewards</h1>
          <p className="mt-1 text-sm text-[var(--slop-slate)]">
            Referral management. Rewards require qualification — registrations
            alone do not earn rewards.
          </p>
        </div>
        <a
          href="/api/analytics/export?type=referrals&range=last_90"
          className="rounded-xl bg-[var(--slop-violet)] px-3 py-2 text-xs font-semibold text-[var(--slop-black)]"
        >
          Export CSV
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Referral clicks" value={data.totals.clicks} />
        <MetricCard label="Registrations" value={data.totals.registrations} />
        <MetricCard label="Qualified free" value={data.totals.qualified} />
        <MetricCard label="Premium referrals" value={data.totals.premium} />
        <MetricCard label="Rewards issued" value={data.totals.issued} />
        <MetricCard label="Redeemed" value={data.totals.redeemed} />
        <MetricCard label="Pending" value={data.totals.pending} />
        <MetricCard
          label="Click→reg conversion"
          value={`${(data.totals.conversionRate * 100).toFixed(1)}%`}
        />
      </div>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-semibold">Qualification settings</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-[var(--slop-slate)]">
            Min watch minutes for qualified free
            <Input
              type="number"
              className="mt-1"
              defaultValue={data.settings.minWatchMinutesForQualified}
              onBlur={async (e) => {
                await fetch("/api/referrals", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "admin_update_settings",
                    actorId: user?.id,
                    settings: {
                      minWatchMinutesForQualified: Number(e.target.value),
                    },
                  }),
                });
                toast.success("Settings saved");
                void load();
              }}
            />
          </label>
          <label className="text-xs text-[var(--slop-slate)]">
            Attribution window (days)
            <Input
              type="number"
              className="mt-1"
              defaultValue={data.settings.attributionWindowDays}
              onBlur={async (e) => {
                await fetch("/api/referrals", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "admin_update_settings",
                    actorId: user?.id,
                    settings: {
                      attributionWindowDays: Number(e.target.value),
                    },
                  }),
                });
                toast.success("Settings saved");
                void load();
              }}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.settings.requireEmailVerification}
            onChange={async (e) => {
              await fetch("/api/referrals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "admin_update_settings",
                  actorId: user?.id,
                  settings: { requireEmailVerification: e.target.checked },
                }),
              });
              void load();
            }}
          />
          Require email verification for qualification
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.settings.referralEnabled}
            onChange={async (e) => {
              await fetch("/api/referrals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "admin_update_settings",
                  actorId: user?.id,
                  settings: { referralEnabled: e.target.checked },
                }),
              });
              void load();
            }}
          />
          Referral program enabled
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Reward rules</h2>
        {data.rules.map((rule) => (
          <div
            key={rule.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3"
          >
            <div>
              <p className="font-medium">{rule.label}</p>
              <p className="text-xs text-[var(--slop-slate)]">
                {rule.triggerType} ≥ {rule.threshold}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                className="w-24"
                defaultValue={rule.threshold}
                onBlur={async (e) => {
                  await fetch("/api/referrals", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "admin_update_rule",
                      ruleId: rule.id,
                      threshold: Number(e.target.value),
                      actorId: user?.id,
                    }),
                  });
                  toast.success("Rule updated");
                  void load();
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await fetch("/api/referrals", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "admin_update_rule",
                      ruleId: rule.id,
                      active: !rule.active,
                      actorId: user?.id,
                    }),
                  });
                  void load();
                }}
              >
                {rule.active ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Top referrers</h2>
        <div className="space-y-2">
          {data.topReferrers.map((r) => (
            <div
              key={r.userId}
              className="flex justify-between rounded-xl border border-white/10 px-4 py-2 text-sm"
            >
              <span className="truncate">{r.userId}</span>
              <span className="text-[var(--slop-slate)]">
                {r.count} refs · {r.premium} premium
              </span>
            </div>
          ))}
          {data.topReferrers.length === 0 && (
            <p className="text-sm text-[var(--slop-slate)]">
              No referral relationships recorded yet.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Relationships</h2>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {data.relationships.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-white/10 px-4 py-3 text-xs"
            >
              <p>
                <span className="font-semibold">{r.code}</span> · {r.status}
                {r.flags.length ? ` · flags: ${r.flags.join(", ")}` : ""}
              </p>
              <p className="mt-1 text-[var(--slop-slate)]">
                referrer {r.referrerUserId} → {r.referredUserId} · watch{" "}
                {r.watchMinutes}m · email{" "}
                {r.emailVerified ? "verified" : "unverified"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Reward transactions</h2>
        <div className="space-y-2">
          {data.rewards.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{r.status}</p>
                <p className="text-xs text-[var(--slop-slate)]">{r.reason}</p>
              </div>
              <div className="flex gap-2">
                {["earned", "pending"].includes(r.status) && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      await fetch("/api/referrals", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "admin_review_reward",
                          rewardId: r.id,
                          status: "revoked",
                          actorId: user?.id,
                        }),
                      });
                      toast.message("Reward revoked");
                      void load();
                    }}
                  >
                    Revoke
                  </Button>
                )}
                {r.status === "pending" && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await fetch("/api/referrals", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "admin_review_reward",
                          rewardId: r.id,
                          status: "earned",
                          actorId: user?.id,
                        }),
                      });
                      void load();
                    }}
                  >
                    Approve
                  </Button>
                )}
              </div>
            </div>
          ))}
          {data.rewards.length === 0 && (
            <p className="text-sm text-[var(--slop-slate)]">
              No reward transactions yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
