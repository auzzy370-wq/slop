import { NextResponse } from "next/server";
import { readAnalyticsStore } from "@/lib/analytics/store";
import { resolveDateRange } from "@/lib/analytics/dates";
import {
  acquisitionBreakdown,
  contentPerformance,
  dailySeries,
  revenueSummary,
  trafficSummary,
} from "@/lib/analytics/aggregations";
import type { DateRangeKey } from "@/lib/analytics/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") as DateRangeKey) || "last_30";
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const section = searchParams.get("section") || "traffic";
  const { from, to, label } = resolveDateRange(range, fromParam, toParam);
  const store = await readAnalyticsStore();

  if (section === "traffic") {
    return NextResponse.json({
      range: { key: range, label, from: from.toISOString(), to: to.toISOString() },
      traffic: trafficSummary(store, from, to),
      series: dailySeries(store, from, to),
      eventCount: store.events.length,
      sessionCount: store.sessions.length,
      dataNote:
        "Metrics reflect recorded events only. Empty zeros mean no matching events in range — not fabricated traffic.",
    });
  }

  if (section === "acquisition") {
    return NextResponse.json({
      range: { key: range, label, from: from.toISOString(), to: to.toISOString() },
      sources: acquisitionBreakdown(store, from, to),
      campaigns: store.campaigns.map((c) => ({
        ...c,
        links: store.trackingLinks.filter((l) => l.campaignId === c.id),
      })),
    });
  }

  if (section === "content") {
    return NextResponse.json({
      range: { key: range, label, from: from.toISOString(), to: to.toISOString() },
      episodes: contentPerformance(store, from, to),
    });
  }

  if (section === "revenue") {
    return NextResponse.json({
      range: { key: range, label, from: from.toISOString(), to: to.toISOString() },
      revenue: revenueSummary(store, from, to),
      subscriptionEvents: store.subscriptionEvents.filter((e) => {
        const t = new Date(e.occurredAt).getTime();
        return t >= from.getTime() && t <= to.getTime();
      }),
      adRevenueRows: store.adRevenue,
    });
  }

  return NextResponse.json({ error: "unknown_section" }, { status: 400 });
}
