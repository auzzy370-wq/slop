import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const customerId =
    typeof body.customerId === "string" ? body.customerId : null;
  const secret = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3456";

  if (!secret || !customerId) {
    return NextResponse.json({
      demo: true,
      message: "Billing portal requires Stripe customer id.",
    });
  }

  const stripe = new Stripe(secret);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl}/account`,
  });

  return NextResponse.json({ url: session.url });
}
