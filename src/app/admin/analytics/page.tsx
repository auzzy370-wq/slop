"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ColumnChart,
  DateRangeFilter,
  GroupedBars,
  MetricCard,
  SimpleBars,
} from "@/components/admin/date-range-filter";
import type { DateRangeKey } from "@/lib/analytics/types";

function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<DateRangeKey>("last_30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<{
    traffic?: Record<string, number>;
    series?: { date: string; sessions: number; registrations: number; plays: number }[];
    sources?: {
      source: string;
      sessions: number;
      uniqueVisitors: number;
      registrations: number;
      registrationRate: number;
      payingCustomers: number;
      revenueCents: number;
    }[];
    dataNote?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({
      range,
      section: "traffic",
      ...(range === "custom" && from ? { from } : {}),
      ...(range === "custom" && to ? { to } : {}),
    });
    const trafficRes = await fetch(`/api/analytics/summary?${qs}`);
    const traffic = await trafficRes.json();
    qs.set("section", "acquisition");
    const acqRes = await fetch(`/api/analytics/summary?${qs}`);
    const acq = await acqRes.json();
    setData({
      traffic: traffic.traffic,
      series: traffic.series,
      sources: acq.sources,
      dataNote: traffic.dataNote,
    });
    setLoading(false);
  }, [range, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const t = data?.traffic;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Analytics</h1>
          <p className="mt-1 text-sm text-[var(--slop-slate)]">
            Traffic & acquisition from recorded events only — never fabricated.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/analytics/content"
            className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold"
          >
            Content
          </Link>
          <Link
            href="/admin/analytics/revenue"
            className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold"
          >
            Revenue
          </Link>
          <Link
            href="/admin/campaigns"
            className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold"
          >
            Campaigns
          </Link>
          <a
            href={`/api/analytics/export?range=${range}&type=traffic`}
            className="rounded-xl bg-[var(--slop-violet)] px-3 py-2 text-xs font-semibold text-[var(--slop-black)]"
          >
            Export CSV
          </a>
        </div>
      </div>

      <DateRangeFilter
        value={range}
        onChange={setRange}
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
      />

      {loading && (
        <p className="text-sm text-[var(--slop-slate)]">Loading recorded metrics…</p>
      )}

      {t && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Sessions" value={t.totalSessions} />
          <MetricCard label="Unique visitors" value={t.uniqueVisitors} />
          <MetricCard label="New visitors" value={t.newVisitors} />
          <MetricCard label="Returning visitors" value={t.returningVisitors} />
          <MetricCard label="Registered users (in range)" value={t.registeredUsers} />
          <MetricCard label="Guest sessions" value={t.guestSessions} />
          <MetricCard label="Currently active (5m)" value={t.currentlyActive} />
          <MetricCard
            label="Avg session duration"
            value={fmtDuration(t.averageSessionDurationMs)}
          />
          <MetricCard label="Pages / session" value={t.pagesPerSession} />
          <MetricCard label="Engagement rate" value={pct(t.engagementRate)} />
          <MetricCard label="Bounce rate" value={pct(t.bounceRate)} />
          <MetricCard label="Registrations" value={t.registrations} />
        </div>
      )}

      {data?.dataNote && (
        <p className="rounded-xl border border-[var(--slop-violet)]/20 bg-[var(--slop-violet)]/10 px-4 py-3 text-xs text-[var(--slop-lavender)]">
          {data.dataNote}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-4 font-semibold">Daily sessions</h2>
          <ColumnChart
            height={140}
            data={(data?.series ?? []).map((d) => ({
              label: d.date.slice(5),
              value: d.sessions,
            }))}
          />
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-4 font-semibold">Sessions vs plays</h2>
          <GroupedBars
            aLabel="Sessions"
            bLabel="Plays"
            data={(data?.series ?? []).map((d) => ({
              label: d.date.slice(5),
              a: d.sessions,
              b: d.plays,
            }))}
          />
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-4 font-semibold">Daily registrations</h2>
        <SimpleBars
          data={(data?.series ?? []).map((d) => ({
            label: d.date.slice(5),
            value: d.registrations,
          }))}
        />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-4 font-semibold">Acquisition by source</h2>
        <div className="mb-5">
          <SimpleBars
            labelWidth={100}
            data={(data?.sources ?? []).map((s) => ({
              label: s.source.replace(/_/g, " "),
              value: s.sessions,
            }))}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-[var(--slop-slate)]">
              <tr>
                <th className="pb-2">Source</th>
                <th className="pb-2">Sessions</th>
                <th className="pb-2">Visitors</th>
                <th className="pb-2">Regs</th>
                <th className="pb-2">Reg rate</th>
                <th className="pb-2">Paying</th>
                <th className="pb-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {(data?.sources ?? []).map((s) => (
                <tr key={s.source} className="border-t border-white/5">
                  <td className="py-2 font-medium capitalize">
                    <Link
                      href={`/admin/campaigns?source=${s.source}`}
                      className="text-[var(--slop-violet)]"
                    >
                      {s.source.replace(/_/g, " ")}
                    </Link>
                  </td>
                  <td>{s.sessions}</td>
                  <td>{s.uniqueVisitors}</td>
                  <td>{s.registrations}</td>
                  <td>{pct(s.registrationRate)}</td>
                  <td>{s.payingCustomers}</td>
                  <td>${(s.revenueCents / 100).toFixed(2)}</td>
                </tr>
              ))}
              {(data?.sources ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-[var(--slop-slate)]">
                    No attributed sessions recorded yet. Visit the site with UTM
                    params or referral links to populate this table.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
