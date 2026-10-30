import { NextResponse } from "next/server";
import { z } from "zod";
import { updateAnalyticsStore } from "@/lib/analytics/store";
import { requireAdminKey } from "@/lib/admin-guard";
import { uid } from "@/lib/utils";

const schema = z.object({
  provider: z.string().min(1),
  occurredOn: z.string().min(4),
  impressions: z.number().nonnegative(),
  requests: z.number().nonnegative(),
  completions: z.number().nonnegative(),
  clicks: z.number().nonnegative(),
  revenueCents: z.number().nonnegative(),
  isEstimate: z.boolean().optional(),
  dramaId: z.string().nullable().optional(),
  episodeId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const row = {
    id: uid("adrev"),
    provider: parsed.data.provider,
    occurredOn: parsed.data.occurredOn,
    impressions: parsed.data.impressions,
    requests: parsed.data.requests,
    completions: parsed.data.completions,
    clicks: parsed.data.clicks,
    revenueCents: parsed.data.revenueCents,
    isEstimate: parsed.data.isEstimate ?? false,
    dramaId: parsed.data.dramaId ?? null,
    episodeId: parsed.data.episodeId ?? null,
    campaignId: parsed.data.campaignId ?? null,
    importedAt: new Date().toISOString(),
  };
  await updateAnalyticsStore((s) => {
    s.adRevenue.push(row);
    s.auditLog.push({
      id: uid("aud"),
      actorId: "admin",
      action: "ad_revenue_imported",
      meta: { id: row.id, provider: row.provider, revenueCents: row.revenueCents },
      createdAt: new Date().toISOString(),
    });
  });
  return NextResponse.json({ ok: true, record: row });
}
