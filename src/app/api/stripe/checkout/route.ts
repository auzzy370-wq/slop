import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : undefined;
  const userId = typeof body.userId === "string" ? body.userId : undefined;

  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3456";

  if (!secret || !priceId) {
    return NextResponse.json({
      demo: true,
      message:
        "Stripe is not configured. Demo mode can activate Premium locally.",
    });
  }

  const stripe = new Stripe(secret);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/premium?checkout=success`,
    cancel_url: `${siteUrl}/premium?checkout=cancel`,
    metadata: {
      userId: userId ?? "",
    },
    subscription_data: {
      metadata: {
        userId: userId ?? "",
      },
    },
  });

  return NextResponse.json({ url: session.url });
}
