import { readAnalyticsStore } from "@/lib/analytics/store";
import { resolveDateRange } from "@/lib/analytics/dates";
import {
  acquisitionBreakdown,
  contentPerformance,
  revenueSummary,
  trafficSummary,
} from "@/lib/analytics/aggregations";
import type { DateRangeKey } from "@/lib/analytics/types";

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "message\nNo data in range\n";
  const keys = Object.keys(rows[0]);
  return [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => csvEscape(r[k])).join(",")),
  ].join("\n");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") as DateRangeKey) || "last_30";
  const type = searchParams.get("type") || "traffic";
  const { from, to } = resolveDateRange(
    range,
    searchParams.get("from"),
    searchParams.get("to"),
  );
  const store = await readAnalyticsStore();

  let rows: Record<string, unknown>[] = [];
  if (type === "traffic") {
    const t = trafficSummary(store, from, to);
    rows = [t as unknown as Record<string, unknown>];
  } else if (type === "acquisition") {
    rows = acquisitionBreakdown(store, from, to) as unknown as Record<
      string,
      unknown
    >[];
  } else if (type === "content") {
    rows = contentPerformance(store, from, to) as unknown as Record<
      string,
      unknown
    >[];
  } else if (type === "revenue") {
    rows = [revenueSummary(store, from, to) as unknown as Record<string, unknown>];
  } else if (type === "referrals") {
    rows = store.referralRelationships as unknown as Record<string, unknown>[];
  } else if (type === "campaigns") {
    rows = store.campaigns.map((c) => ({
      ...c,
      clicks: store.trackingLinks
        .filter((l) => l.campaignId === c.id)
        .reduce((a, l) => a + l.clickCount, 0),
    }));
  }

  const body = toCsv(rows);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="slop-${type}-${range}.csv"`,
    },
  });
}
