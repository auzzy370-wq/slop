# SLOP

**Stories That Keep You Watching.**

SLOP is a premium short-form drama streaming platform — cinematic AI-powered series across romance, thriller, revenge, fantasy, suspense, and drama. Built as a responsive website and PWA with a vertical episode player.

## Brand

| Token | Value |
| --- | --- |
| Midnight Black | `#111116` |
| Electric Violet | `#B99AFF` |
| Pure White | `#FFFFFF` |
| Slate Gray | `#777581` |
| Soft Lavender | `#E9DEFF` |
| Headlines | Space Grotesk |
| Body / buttons | Inter |
| Tagline | Stories That Keep You Watching. |

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase schema + RLS (`supabase/migrations`)
- Stripe Checkout / Billing for **$7.99/mo** Premium
- Demo mode runs without cloud credentials

## Quick start

```bash
npm install
cp .env.example .env.local   # optional
npm run dev
```

App: [http://localhost:3456](http://localhost:3456)

### Demo sign-in

- **Demo viewer** — likes, saves, comments, reports
- **Demo admin** — `/admin` dashboard

## Product surfaces

- **Home** — cinematic browse (featured banner, genres, trending, recently added)
- **Drama pages** — synopsis + episode list
- **Watch** — vertical short-form episode feed with ads for free users
- **Explore / genres / search** — discovery
- **Premium** — Stripe-ready ad-free subscription
- **Admin** — episode publish, categories, moderation, settings

## Analytics & Rewards

Production-ready event analytics, attribution, campaigns, content/revenue dashboards, and SLOP Rewards referrals. Metrics come from **recorded events only** (never fabricated).

- Admin: `/admin/analytics`, `/admin/analytics/content`, `/admin/analytics/revenue`, `/admin/campaigns`, `/admin/referrals`
- User: `/account/rewards`
- Docs: [`docs/ANALYTICS.md`](docs/ANALYTICS.md)
- Schema: `supabase/migrations/002_analytics_referrals.sql`
- Optional: PostHog + GA4 via `.env.example`

## Rules

- Watch without registering
- No user uploads / no user-facing AI generator
- Only admins publish dramas & episodes
- Free sees ads; verified Premium does not
- Premium status comes from trusted backend/Stripe data
- Analytics never invent traffic, revenue, or users
