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
    series?: {
      date: string;
      sessions: number;
      registrations: number;
      plays: number;
    }[];
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
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden sm:space-y-8">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-[var(--slop-slate)]">
            Traffic & acquisition from recorded events only — never fabricated.
          </p>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-none sm:flex-wrap sm:overflow-visible">
          <Link
            href="/admin/analytics/content"
            className="shrink-0 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold"
          >
            Content
          </Link>
          <Link
            href="/admin/analytics/revenue"
            className="shrink-0 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold"
          >
            Revenue
          </Link>
          <Link
            href="/admin/campaigns"
            className="shrink-0 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold"
          >
            Campaigns
          </Link>
          <a
            href={`/api/analytics/export?range=${range}&type=traffic`}
            className="shrink-0 rounded-xl bg-[var(--slop-violet)] px-3 py-2 text-xs font-semibold text-[var(--slop-black)]"
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
        <p className="text-sm text-[var(--slop-slate)]">
          Loading recorded metrics…
        </p>
      )}

      {t && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <MetricCard label="Sessions" value={t.totalSessions} />
          <MetricCard label="Unique visitors" value={t.uniqueVisitors} />
          <MetricCard label="New visitors" value={t.newVisitors} />
          <MetricCard label="Returning visitors" value={t.returningVisitors} />
          <MetricCard
            label="Registered users"
            value={t.registeredUsers}
            hint="In selected range"
          />
          <MetricCard label="Guest sessions" value={t.guestSessions} />
          <MetricCard
            label="Active now"
            value={t.currentlyActive}
            hint="Last 5 minutes"
          />
          <MetricCard
            label="Avg session"
            value={fmtDuration(t.averageSessionDurationMs)}
          />
          <MetricCard label="Pages / session" value={t.pagesPerSession} />
          <MetricCard label="Engagement rate" value={pct(t.engagementRate)} />
          <MetricCard label="Bounce rate" value={pct(t.bounceRate)} />
          <MetricCard label="Registrations" value={t.registrations} />
        </div>
      )}

      {data?.dataNote && (
        <p className="rounded-xl border border-[var(--slop-violet)]/20 bg-[var(--slop-violet)]/10 px-3 py-3 text-xs leading-relaxed text-[var(--slop-lavender)] sm:px-4">
          {data.dataNote}
        </p>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
          <h2 className="mb-3 font-semibold sm:mb-4">Daily sessions</h2>
          <ColumnChart
            height={150}
            data={(data?.series ?? []).map((d) => ({
              label: d.date.slice(5),
              value: d.sessions,
            }))}
          />
        </section>
        <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
          <h2 className="mb-3 font-semibold sm:mb-4">Sessions vs plays</h2>
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

      <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
        <h2 className="mb-3 font-semibold sm:mb-4">Daily registrations</h2>
        <SimpleBars
          maxRows={14}
          data={(data?.series ?? []).map((d) => ({
            label: d.date.slice(5),
            value: d.registrations,
          }))}
        />
      </section>

      <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
        <h2 className="mb-3 font-semibold sm:mb-4">Acquisition by source</h2>
        <div className="mb-5 min-w-0">
          <SimpleBars
            labelWidth={100}
            data={(data?.sources ?? []).map((s) => ({
              label: s.source.replace(/_/g, " "),
              value: s.sessions,
            }))}
          />
        </div>

        {/* Mobile: stacked source cards instead of wide table */}
        <div className="space-y-2 md:hidden">
          {(data?.sources ?? []).map((s) => (
            <Link
              key={s.source}
              href={`/admin/campaigns?source=${s.source}`}
              className="block rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <p className="font-medium capitalize text-[var(--slop-violet)]">
                {s.source.replace(/_/g, " ")}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-white/60">
                <span>Sessions {s.sessions}</span>
                <span>Visitors {s.uniqueVisitors}</span>
                <span>Regs {s.registrations}</span>
                <span>Reg rate {pct(s.registrationRate)}</span>
                <span>Paying {s.payingCustomers}</span>
                <span>${(s.revenueCents / 100).toFixed(2)}</span>
              </div>
            </Link>
          ))}
          {(data?.sources ?? []).length === 0 && (
            <p className="py-3 text-sm text-[var(--slop-slate)]">
              No attributed sessions recorded yet. Visit the site with UTM params
              or referral links to populate this list.
            </p>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
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
