"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  DateRangeFilter,
  MetricCard,
  SimpleBars,
  StackedShareBar,
} from "@/components/admin/date-range-filter";
import type { DateRangeKey } from "@/lib/analytics/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function RevenueAnalyticsPage() {
  const [range, setRange] = useState<DateRangeKey>("last_30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [revenue, setRevenue] = useState<Record<string, number | string | boolean> | null>(null);
  const [importForm, setImportForm] = useState({
    provider: "manual",
    occurredOn: new Date().toISOString().slice(0, 10),
    impressions: "0",
    requests: "0",
    completions: "0",
    clicks: "0",
    revenueCents: "0",
    isEstimate: false,
  });

  const load = useCallback(async () => {
    const qs = new URLSearchParams({
      range,
      section: "revenue",
      ...(range === "custom" && from ? { from } : {}),
      ...(range === "custom" && to ? { to } : {}),
    });
    const res = await fetch(`/api/analytics/summary?${qs}`);
    const json = await res.json();
    setRevenue(json.revenue);
  }, [range, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const importRevenue = async () => {
    const res = await fetch("/api/analytics/ad-revenue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...importForm,
        impressions: Number(importForm.impressions),
        requests: Number(importForm.requests),
        completions: Number(importForm.completions),
        clicks: Number(importForm.clicks),
        revenueCents: Number(importForm.revenueCents),
      }),
    });
    if (!res.ok) {
      toast.error("Import failed");
      return;
    }
    toast.success("Ad revenue record imported");
    void load();
  };

  const r = revenue;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Revenue</h1>
          <p className="mt-1 text-sm text-[var(--slop-slate)]">
            Subscription figures come from recorded payment events. Ad revenue
            appears only after provider import — never invented from impressions.
          </p>
        </div>
        <Link href="/admin/analytics" className="text-sm text-[var(--slop-violet)]">
          ← Analytics
        </Link>
      </div>

      <DateRangeFilter
        value={range}
        onChange={setRange}
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
      />

      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Gross revenue"
              value={`$${(Number(r.grossRevenueCents) / 100).toFixed(2)}`}
            />
            <MetricCard
              label="Subscription revenue"
              value={`$${(Number(r.subscriptionRevenueCents) / 100).toFixed(2)}`}
            />
            <MetricCard
              label="Ad revenue"
              value={`$${(Number(r.advertisingRevenueCents) / 100).toFixed(2)}`}
              hint={r.advertisingIsEstimate ? "Includes estimates" : undefined}
            />
            <MetricCard
              label="Est. net (gross − refunds)"
              value={`$${(Number(r.estimatedNetRevenueCents) / 100).toFixed(2)}`}
            />
            <MetricCard label="Ad impressions" value={Number(r.adImpressions)} />
            <MetricCard label="Ad requests" value={Number(r.adRequests)} />
            <MetricCard
              label="Fill rate"
              value={`${(Number(r.fillRate) * 100).toFixed(1)}%`}
            />
            <MetricCard
              label="Ad CTR"
              value={`${(Number(r.ctr) * 100).toFixed(2)}%`}
            />
            <MetricCard label="Failed payments" value={Number(r.failedPayments)} />
            <MetricCard label="Cancellations" value={Number(r.cancellations)} />
            <MetricCard
              label="Refunds"
              value={`$${(Number(r.refundsCents) / 100).toFixed(2)}`}
            />
            <MetricCard
              label="RPM"
              value={`$${Number(r.rpm).toFixed(2)}`}
              hint="Only meaningful with imported revenue"
            />
          </div>
          <p className="text-xs text-[var(--slop-lavender)]">{String(r.note)}</p>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="mb-4 font-semibold">Revenue mix</h2>
              <StackedShareBar
                formatValue={(n) => `$${(n / 100).toFixed(2)}`}
                segments={[
                  {
                    label: "Subscriptions",
                    value: Number(r.subscriptionRevenueCents) || 0,
                    color: "var(--slop-violet)",
                  },
                  {
                    label: "Ads",
                    value: Number(r.advertisingRevenueCents) || 0,
                    color: "#34d399",
                  },
                  {
                    label: "Refunds",
                    value: Number(r.refundsCents) || 0,
                    color: "#f87171",
                  },
                ]}
              />
            </section>
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="mb-4 font-semibold">Ad funnel</h2>
              <SimpleBars
                labelWidth={100}
                data={[
                  {
                    label: "Requests",
                    value: Number(r.adRequests) || 0,
                    color: "rgba(185, 154, 255, 0.4)",
                  },
                  {
                    label: "Impressions",
                    value: Number(r.adImpressions) || 0,
                    color: "var(--slop-violet)",
                  },
                  {
                    label: "Completions",
                    value: Number(r.adCompletions) || 0,
                    color: "#34d399",
                  },
                  {
                    label: "Clicks",
                    value: Number(r.adClicks) || 0,
                    color: "#f59e0b",
                  },
                ]}
              />
            </section>
          </div>
        </>
      )}

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-semibold">Import ad revenue record</h2>
        <p className="text-xs text-[var(--slop-slate)]">
          Paste figures from your ad network. Mark estimates clearly — the
          dashboard will label them.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Provider"
            value={importForm.provider}
            onChange={(e) =>
              setImportForm({ ...importForm, provider: e.target.value })
            }
          />
          <Input
            type="date"
            value={importForm.occurredOn}
            onChange={(e) =>
              setImportForm({ ...importForm, occurredOn: e.target.value })
            }
          />
          <Input
            placeholder="Impressions"
            value={importForm.impressions}
            onChange={(e) =>
              setImportForm({ ...importForm, impressions: e.target.value })
            }
          />
          <Input
            placeholder="Requests"
            value={importForm.requests}
            onChange={(e) =>
              setImportForm({ ...importForm, requests: e.target.value })
            }
          />
          <Input
            placeholder="Completions"
            value={importForm.completions}
            onChange={(e) =>
              setImportForm({ ...importForm, completions: e.target.value })
            }
          />
          <Input
            placeholder="Clicks"
            value={importForm.clicks}
            onChange={(e) =>
              setImportForm({ ...importForm, clicks: e.target.value })
            }
          />
          <Input
            placeholder="Revenue cents (e.g. 1250 = $12.50)"
            value={importForm.revenueCents}
            onChange={(e) =>
              setImportForm({ ...importForm, revenueCents: e.target.value })
            }
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={importForm.isEstimate}
              onChange={(e) =>
                setImportForm({ ...importForm, isEstimate: e.target.checked })
              }
            />
            Mark as estimate
          </label>
        </div>
        <Button onClick={importRevenue}>Import record</Button>
      </section>
    </div>
  );
}
