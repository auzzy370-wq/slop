"use client";

import { DEMO_STATS } from "@/lib/demo-data";
import { formatCount } from "@/lib/utils";
import { getFeed } from "@/lib/feed";
import { useSlopStore } from "@/store/slop-store";

export default function AdminOverviewPage() {
  const videos = useSlopStore((s) => s.videos);
  const reports = useSlopStore((s) => s.reports);
  const popular = getFeed(videos, "most-viewed").slice(0, 5);
  const openReports = reports.filter((r) => r.status === "open").length;

  const cards = [
    { label: "Registered users", value: formatCount(DEMO_STATS.totalUsers) },
    { label: "Daily active", value: formatCount(DEMO_STATS.dailyActiveUsers) },
    { label: "Monthly active", value: formatCount(DEMO_STATS.monthlyActiveUsers) },
    {
      label: "Published videos",
      value: String(videos.filter((v) => v.status === "published").length),
    },
    {
      label: "Total views",
      value: formatCount(videos.reduce((s, v) => s + v.viewCount, 0)),
    },
    { label: "Watch time (hrs)", value: formatCount(DEMO_STATS.watchTimeHours) },
    {
      label: "Active premium",
      value: String(DEMO_STATS.activePremium),
    },
    {
      label: "Est. sub revenue / mo",
      value: `$${DEMO_STATS.estimatedMonthlyRevenue.toFixed(0)}`,
      note: "Estimate from active count × $7.99",
    },
    { label: "Open reports", value: String(openReports) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Catalog counts are live from the content store. For traffic, acquisition,
          content performance, and verified revenue, open{" "}
          <a href="/admin/analytics" className="text-[var(--slop-violet)]">
            Analytics
          </a>{" "}
          — those boards use recorded events only.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <p className="text-xs uppercase tracking-wide text-white/45">
              {card.label}
            </p>
            <p className="mt-2 font-display text-2xl font-bold">
              {card.value}
            </p>
            {"note" in card && card.note ? (
              <p className="mt-1 text-[11px] text-white/35">{card.note}</p>
            ) : null}
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/45">
          Most popular
        </h2>
        <div className="space-y-2">
          {popular.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm"
            >
              <span className="truncate font-medium">{v.title}</span>
              <span className="shrink-0 text-white/45">
                {formatCount(v.viewCount)} views
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
