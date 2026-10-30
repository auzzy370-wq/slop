import { NextResponse } from "next/server";
import { z } from "zod";
import { updateAnalyticsStore } from "@/lib/analytics/store";
import { ingestEvent } from "@/lib/analytics/service";
import { markPremiumReferral } from "@/lib/referrals/service";
import { uid } from "@/lib/utils";
import type { AnalyticsEventName } from "@/lib/analytics/types";

const schema = z.object({
  userId: z.string(),
  eventType: z.string(),
  amountCents: z.number().optional().nullable(),
  currency: z.string().optional(),
  stripeEventId: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const data = parsed.data;

  let duplicate = false;
  await updateAnalyticsStore((s) => {
    if (
      data.idempotencyKey &&
      s.processedIdempotencyKeys.includes(data.idempotencyKey)
    ) {
      duplicate = true;
      return;
    }
    if (
      data.stripeEventId &&
      s.subscriptionEvents.some((e) => e.stripeEventId === data.stripeEventId)
    ) {
      duplicate = true;
      return;
    }
    s.subscriptionEvents.push({
      id: uid("subev"),
      userId: data.userId,
      eventType: data.eventType,
      stripeEventId: data.stripeEventId ?? null,
      amountCents: data.amountCents ?? null,
      currency: data.currency ?? "usd",
      occurredAt: new Date().toISOString(),
      meta: {},
    });
    if (data.idempotencyKey) {
      s.processedIdempotencyKeys.push(data.idempotencyKey);
    }
  });

  if (duplicate) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const map: Record<string, AnalyticsEventName> = {
    payment_completed: "payment_completed",
    subscription_started: "subscription_started",
    subscription_renewed: "subscription_renewed",
    subscription_canceled: "subscription_canceled",
    payment_failed: "payment_failed",
  };
  if (map[data.eventType]) {
    await ingestEvent({
      eventName: map[data.eventType],
      userId: data.userId,
      idempotencyKey: data.idempotencyKey
        ? `evt:${data.idempotencyKey}`
        : data.stripeEventId
          ? `stripe:${data.stripeEventId}`
          : null,
      properties: { amountCents: data.amountCents },
    });
  }

  if (
    data.eventType === "subscription_started" ||
    data.eventType === "payment_completed"
  ) {
    await markPremiumReferral({ referredUserId: data.userId, paidDays: 30 });
  }

  return NextResponse.json({ ok: true });
}
