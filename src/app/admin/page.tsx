"use client";

import { useEffect, useState } from "react";
import { formatCount } from "@/lib/utils";
import { getFeed } from "@/lib/feed";
import { useSlopStore } from "@/store/slop-store";

type Traffic = {
  totalSessions?: number;
  uniqueVisitors?: number;
  dailyActiveApprox?: number;
  currentlyActive?: number;
  registrations?: number;
  totalEvents?: number;
};

type ContentEpisode = {
  episodeId: string;
  plays: number;
  totalWatchMs: number;
};

type Revenue = {
  subscriptionRevenueCents?: number;
};

export default function AdminOverviewPage() {
  const videos = useSlopStore((s) => s.videos);
  const reports = useSlopStore((s) => s.reports);
  const subscription = useSlopStore((s) => s.subscription);
  const currentUser = useSlopStore((s) => s.currentUser);
  const popular = getFeed(videos, "most-viewed").slice(0, 5);
  const openReports = reports.filter((r) => r.status === "open").length;

  const [traffic, setTraffic] = useState<Traffic | null>(null);
  const [episodes, setEpisodes] = useState<ContentEpisode[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tRes, cRes, rRes] = await Promise.all([
          fetch("/api/analytics/summary?range=last_30&section=traffic"),
          fetch("/api/analytics/summary?range=last_30&section=content"),
          fetch("/api/analytics/summary?range=last_30&section=revenue"),
        ]);
        const t = await tRes.json();
        const c = await cRes.json();
        const r = await rRes.json();
        if (cancelled) return;
        setTraffic(t.traffic ?? null);
        setEpisodes(c.episodes ?? []);
        setRevenue(r.revenue ?? r ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPlays = episodes.reduce((s, e) => s + e.plays, 0);
  const watchTimeHours =
    episodes.reduce((s, e) => s + (e.totalWatchMs || 0), 0) / 3_600_000;
  const localPremiumActive =
    currentUser?.isPremium && subscription?.status === "active" ? 1 : 0;
  const activePremium = localPremiumActive;
  const subRevenueCents = revenue?.subscriptionRevenueCents ?? 0;

  const cards = [
    {
      label: "Sessions (30d)",
      value: loading ? "…" : formatCount(traffic?.totalSessions ?? 0),
      note: "Recorded sessions only",
    },
    {
      label: "Unique visitors (30d)",
      value: loading ? "…" : formatCount(traffic?.uniqueVisitors ?? 0),
      note: "From analytics store",
    },
    {
      label: "Active now",
      value: loading ? "…" : formatCount(traffic?.currentlyActive ?? 0),
      note: "Seen in last 5 minutes",
    },
    {
      label: "Published videos",
      value: String(videos.filter((v) => v.status === "published").length),
      note: "Catalog count",
    },
    {
      label: "Plays (30d)",
      value: loading ? "…" : formatCount(totalPlays),
      note: "Playback sessions started",
    },
    {
      label: "Watch time (hrs, 30d)",
      value: loading ? "…" : watchTimeHours.toFixed(1),
      note: "From playback progress",
    },
    {
      label: "Registrations (30d)",
      value: loading ? "…" : formatCount(traffic?.registrations ?? 0),
      note: "Recorded registration events",
    },
    {
      label: "Active premium",
      value: String(activePremium),
      note: "Verified subscription records only",
    },
    {
      label: "Sub revenue (30d)",
      value: `$${(subRevenueCents / 100).toFixed(2)}`,
      note: "From recorded subscription events",
    },
    { label: "Open reports", value: String(openReports), note: "Local moderation queue" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-white/50">
          Every traffic, play, and revenue number below comes from recorded
          events — zeros mean nothing happened yet, not placeholder demos. Dig
          deeper in{" "}
          <a href="/admin/analytics" className="text-[var(--slop-violet)]">
            Analytics
          </a>
          .
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
            <p className="mt-2 font-display text-2xl font-bold">{card.value}</p>
            {card.note ? (
              <p className="mt-1 text-[11px] text-white/35">{card.note}</p>
            ) : null}
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/45">
          Most played (local counts)
        </h2>
        <p className="mb-3 text-xs text-white/35">
          Public view counters start at 0 and rise only when someone watches.
          They sync from recorded playback when available.
        </p>
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
