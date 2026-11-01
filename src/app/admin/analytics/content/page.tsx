"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ColumnChart,
  DateRangeFilter,
  MetricCard,
  SimpleBars,
} from "@/components/admin/date-range-filter";
import type { DateRangeKey } from "@/lib/analytics/types";
import { useSlopStore } from "@/store/slop-store";

export default function ContentAnalyticsPage() {
  const videos = useSlopStore((s) => s.videos);
  const dramas = useSlopStore((s) => s.dramas);
  const [range, setRange] = useState<DateRangeKey>("last_30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [episodes, setEpisodes] = useState<
    {
      episodeId: string;
      dramaId: string | null;
      plays: number;
      uniqueViewers: number;
      averageWatchMs: number;
      totalWatchMs: number;
      completion25Rate: number;
      completion50Rate: number;
      completion75Rate: number;
      completion100Rate: number;
      abandonmentRate: number;
      shares: number;
      watchlistAdds: number;
    }[]
  >([]);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({
      range,
      section: "content",
      ...(range === "custom" && from ? { from } : {}),
      ...(range === "custom" && to ? { to } : {}),
    });
    const res = await fetch(`/api/analytics/summary?${qs}`);
    const json = await res.json();
    setEpisodes(json.episodes ?? []);
  }, [range, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const titleFor = (id: string) =>
    videos.find((v) => v.id === id)?.title ?? id;
  const dramaFor = (id: string | null) =>
    dramas.find((d) => d.id === id)?.title ?? "—";

  const totalPlays = episodes.reduce((a, e) => a + e.plays, 0);
  const avgCompletion =
    episodes.length === 0
      ? 0
      : episodes.reduce((a, e) => a + e.completion100Rate, 0) / episodes.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Content performance</h1>
          <p className="mt-1 text-sm text-[var(--slop-slate)]">
            Playback sessions are deduplicated by playback ID — heartbeats do not
            inflate starts.
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total plays" value={totalPlays} />
        <MetricCard label="Episodes with data" value={episodes.length} />
        <MetricCard
          label="Avg 100% completion"
          value={`${(avgCompletion * 100).toFixed(1)}%`}
        />
        <MetricCard
          label="Total watch time"
          value={`${Math.round(
            episodes.reduce((a, e) => a + e.totalWatchMs, 0) / 60000,
          )} min`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-4 font-semibold">Top episodes by plays</h2>
          <SimpleBars
            labelWidth={110}
            data={[...episodes]
              .sort((a, b) => b.plays - a.plays)
              .slice(0, 12)
              .map((e) => ({
                label: titleFor(e.episodeId),
                value: e.plays,
              }))}
          />
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-4 font-semibold">Completion funnel (avg %)</h2>
          <SimpleBars
            labelWidth={72}
            formatValue={(n) => `${n.toFixed(0)}%`}
            data={[
              {
                label: "25%",
                value:
                  episodes.length === 0
                    ? 0
                    : (episodes.reduce((a, e) => a + e.completion25Rate, 0) /
                        episodes.length) *
                      100,
                color: "rgba(185, 154, 255, 0.35)",
              },
              {
                label: "50%",
                value:
                  episodes.length === 0
                    ? 0
                    : (episodes.reduce((a, e) => a + e.completion50Rate, 0) /
                        episodes.length) *
                      100,
                color: "rgba(185, 154, 255, 0.55)",
              },
              {
                label: "75%",
                value:
                  episodes.length === 0
                    ? 0
                    : (episodes.reduce((a, e) => a + e.completion75Rate, 0) /
                        episodes.length) *
                      100,
                color: "rgba(185, 154, 255, 0.75)",
              },
              {
                label: "100%",
                value: avgCompletion * 100,
                color: "var(--slop-violet)",
              },
            ]}
          />
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold text-white/80">
              Watch time by episode (min)
            </h3>
            <ColumnChart
              height={120}
              data={[...episodes]
                .sort((a, b) => b.totalWatchMs - a.totalWatchMs)
                .slice(0, 14)
                .map((e) => ({
                  label: titleFor(e.episodeId).slice(0, 8),
                  value: Math.round(e.totalWatchMs / 60000),
                }))}
            />
          </div>
        </section>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase text-[var(--slop-slate)]">
            <tr>
              <th className="p-3">Episode</th>
              <th className="p-3">Drama</th>
              <th className="p-3">Plays</th>
              <th className="p-3">Unique</th>
              <th className="p-3">Avg watch</th>
              <th className="p-3">25%</th>
              <th className="p-3">50%</th>
              <th className="p-3">75%</th>
              <th className="p-3">100%</th>
              <th className="p-3">Abandon</th>
              <th className="p-3">Shares</th>
            </tr>
          </thead>
          <tbody>
            {episodes.map((e) => (
              <tr key={e.episodeId} className="border-t border-white/5">
                <td className="p-3 font-medium">{titleFor(e.episodeId)}</td>
                <td className="p-3">{dramaFor(e.dramaId)}</td>
                <td className="p-3">{e.plays}</td>
                <td className="p-3">{e.uniqueViewers}</td>
                <td className="p-3">
                  {Math.round(e.averageWatchMs / 1000)}s
                </td>
                <td className="p-3">{(e.completion25Rate * 100).toFixed(0)}%</td>
                <td className="p-3">{(e.completion50Rate * 100).toFixed(0)}%</td>
                <td className="p-3">{(e.completion75Rate * 100).toFixed(0)}%</td>
                <td className="p-3">{(e.completion100Rate * 100).toFixed(0)}%</td>
                <td className="p-3">{(e.abandonmentRate * 100).toFixed(0)}%</td>
                <td className="p-3">{e.shares}</td>
              </tr>
            ))}
            {episodes.length === 0 && (
              <tr>
                <td colSpan={11} className="p-6 text-[var(--slop-slate)]">
                  No playback sessions recorded in this range. Open /watch and
                  play an episode to generate real data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
