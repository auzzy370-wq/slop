# SLOP

**Stories That Keep You Watching.**

SLOP is a premium short-form drama streaming platform — **30 cinematic AI-powered series** (190 episodes) across romance, thriller, revenge, fantasy, suspense, and drama. Built as a responsive website and PWA with a vertical episode player.

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
| Logo | Gradient violet app tile + geometric **S** monogram + `SLOP` wordmark (`src/components/brand/logo.tsx`) |

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase schema + RLS (`supabase/migrations`)
- Stripe Checkout / Billing for **$7.99/mo** Premium
- Demo mode runs without cloud credentials

## Quick start (local)

```bash
npm install
cp .env.example .env.local   # optional
npm run dev
```

App: [http://localhost:3456](http://localhost:3456)

### Demo sign-in

- **Demo viewer** — likes, saves, comments, reports
- **Demo admin** — `/admin` dashboard

## Public deploy (iPhone / Safari)

**https://slop-fawn.vercel.app**

Permanent free Vercel Hobby production URL. Redeploy with:

```bash
vercel --prod
```

## Social auto-post

Publishing **episode 1 or 2** of a show triggers posts to Discord / Telegram / X / Facebook / Zapier webhook.

- Admin UI: `/admin/social`
- Docs: [`docs/SOCIAL_AUTO_POST.md`](docs/SOCIAL_AUTO_POST.md)
- Env: see `.env.example` (`DISCORD_WEBHOOK_URL`, etc.)

## Product surfaces

- **Home** — cinematic browse (featured banner, genres, trending, recently added)
- **Drama pages** — synopsis + episode list
- **Watch** — vertical short-form episode feed with ads for free users
- **Explore / genres / search** — discovery
- **Premium** — Stripe-ready ad-free subscription
- **Admin** — episodes (including **mass MP4 upload** with `EP##` auto-sort), social auto-post, analytics, moderation, settings

### Admin mass upload

1. Sign in as demo admin → `/admin/videos`
2. Under **Mass upload**, pick a drama and drop many MP4s named `EP01`, `EP49`, etc.
3. Files auto-sort by episode number (ascending) and publish into that series

Locally, files save under `public/uploads/`. On Vercel, set `BLOB_READ_WRITE_TOKEN` (Vercel Blob) so large MP4s upload directly to cloud storage.

Episode **metadata** (titles, drama, episode numbers, Blob URLs) is saved to a server catalog (`/api/catalog/uploads`) so uploads survive refresh and show for everyone — not just the browser that uploaded them. Paste `SLOP_ADMIN_KEY` in the Mass upload key field on the public deploy.

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
