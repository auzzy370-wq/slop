import { NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * Stripe webhook handler.
 * Verifies signatures, processes subscription lifecycle events idempotently.
 * Persist to Supabase when configured; never trust client-reported payment success.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook not configured" },
      { status: 503 },
    );
  }

  const stripe = new Stripe(secret);
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { updateAnalyticsStore } = await import("@/lib/analytics/store");
  const { ingestEvent } = await import("@/lib/analytics/service");
  const { markPremiumReferral } = await import("@/lib/referrals/service");
  const { uid } = await import("@/lib/utils");

  // Idempotent: skip if Stripe event id already processed
  let duplicate = false;
  await updateAnalyticsStore((s) => {
    if (s.processedIdempotencyKeys.includes(`stripe:${event.id}`)) {
      duplicate = true;
    }
  });
  if (duplicate) {
    return NextResponse.json({ received: true, id: event.id, duplicate: true });
  }

  const metaUserId = (obj: { metadata?: Record<string, string> | null }) =>
    obj.metadata?.userId || "";

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = metaUserId(session);
      if (userId) {
        await updateAnalyticsStore((s) => {
          s.subscriptionEvents.push({
            id: uid("subev"),
            userId,
            eventType: "subscription_started",
            stripeEventId: event.id,
            amountCents: session.amount_total,
            currency: session.currency ?? "usd",
            occurredAt: new Date().toISOString(),
            meta: { checkoutSessionId: session.id },
          });
          s.processedIdempotencyKeys.push(`stripe:${event.id}`);
        });
        await ingestEvent({
          eventName: "subscription_started",
          userId,
          idempotencyKey: `stripe:${event.id}`,
        });
        await markPremiumReferral({ referredUserId: userId, paidDays: 30 });
      }
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription_details?: { metadata?: Record<string, string> | null } | null;
      };
      const userId = invoice.subscription_details?.metadata?.userId || "";
      await updateAnalyticsStore((s) => {
        s.subscriptionEvents.push({
          id: uid("subev"),
          userId: userId || "unknown",
          eventType: "payment_completed",
          stripeEventId: event.id,
          amountCents: invoice.amount_paid,
          currency: invoice.currency,
          occurredAt: new Date().toISOString(),
          meta: {},
        });
        s.processedIdempotencyKeys.push(`stripe:${event.id}`);
      });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await updateAnalyticsStore((s) => {
        s.subscriptionEvents.push({
          id: uid("subev"),
          userId: "unknown",
          eventType: "payment_failed",
          stripeEventId: event.id,
          amountCents: invoice.amount_due,
          currency: invoice.currency,
          occurredAt: new Date().toISOString(),
          meta: {},
        });
        s.processedIdempotencyKeys.push(`stripe:${event.id}`);
      });
      await ingestEvent({
        eventName: "payment_failed",
        idempotencyKey: `stripe:${event.id}`,
      });
      break;
    }
    case "customer.subscription.deleted": {
      await updateAnalyticsStore((s) => {
        s.subscriptionEvents.push({
          id: uid("subev"),
          userId: "unknown",
          eventType: "subscription_canceled",
          stripeEventId: event.id,
          amountCents: null,
          currency: "usd",
          occurredAt: new Date().toISOString(),
          meta: {},
        });
        s.processedIdempotencyKeys.push(`stripe:${event.id}`);
      });
      await ingestEvent({
        eventName: "subscription_canceled",
        idempotencyKey: `stripe:${event.id}`,
      });
      break;
    }
    default:
      await updateAnalyticsStore((s) => {
        s.processedIdempotencyKeys.push(`stripe:${event.id}`);
      });
      break;
  }

  return NextResponse.json({ received: true, id: event.id });
}
