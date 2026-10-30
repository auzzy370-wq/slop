import { NextResponse } from "next/server";
import { z } from "zod";
import { readAnalyticsStore, updateAnalyticsStore } from "@/lib/analytics/store";
import {
  buildCampaignUrl,
  createCampaign,
  createTrackingLink,
} from "@/lib/analytics/service";
import { uid } from "@/lib/utils";

export async function GET() {
  const store = await readAnalyticsStore();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3456";
  return NextResponse.json({
    campaigns: store.campaigns.map((c) => ({
      ...c,
      links: store.trackingLinks
        .filter((l) => l.campaignId === c.id)
        .map((l) => ({
          ...l,
          url: buildCampaignUrl({
            siteUrl,
            destinationPath: l.destinationPath,
            campaign: c,
            trackingCode: l.code,
          }),
        })),
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(2),
  platform: z.string().min(2),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  notes: z.string().optional(),
  linkLabel: z.string().optional(),
  destinationPath: z.string().optional(),
  actorId: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const campaign = await createCampaign(parsed.data);
  const link = await createTrackingLink({
    campaignId: campaign.id,
    label: parsed.data.linkLabel ?? `${campaign.platform} primary`,
    destinationPath: parsed.data.destinationPath ?? "/",
  });
  await updateAnalyticsStore((s) => {
    s.auditLog.push({
      id: uid("aud"),
      actorId: parsed.data.actorId ?? "admin",
      action: "campaign_created",
      meta: { campaignId: campaign.id, linkId: link.id },
      createdAt: new Date().toISOString(),
    });
  });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3456";
  return NextResponse.json({
    campaign,
    link: {
      ...link,
      url: buildCampaignUrl({
        siteUrl,
        destinationPath: link.destinationPath,
        campaign,
        trackingCode: link.code,
      }),
    },
  });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  await updateAnalyticsStore((s) => {
    const campaign = s.campaigns.find((c) => c.id === id);
    if (!campaign) return;
    if (typeof body.active === "boolean") campaign.active = body.active;
    if (typeof body.name === "string") campaign.name = body.name;
    if (typeof body.notes === "string") campaign.notes = body.notes;
    campaign.updatedAt = new Date().toISOString();
    s.auditLog.push({
      id: uid("aud"),
      actorId: body.actorId ?? "admin",
      action: "campaign_updated",
      meta: { campaignId: id, patch: body },
      createdAt: new Date().toISOString(),
    });
  });
  return NextResponse.json({ ok: true });
}
