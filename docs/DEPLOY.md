# Deploy SLOP (free public HTTPS)

SLOP is a **Next.js App Router** app with API routes (analytics, referrals, Stripe). It is **not** a static site. Host on **Vercel** (free Hobby tier).

## Public URL (current anonymous deploy)

| Item | Value |
| --- | --- |
| Public HTTPS | https://prompt-gold-o5sbpw9.tmp.now |
| Hosting | Vercel (anonymous / temporary) |
| Expires | ~60 minutes unless claimed |
| **Claim (make permanent, free)** | https://vercel.com/claim-deployment?code=a8f2942f-60b6-4e9d-b857-cb44416b7e6e |

Open the claim link on your phone or computer, sign up for a free Vercel account, and keep the deployment. After claiming you get a stable `*.vercel.app` URL.

## Why Vercel (not Cloudflare Pages / Netlify static)

- Server Route Handlers: `/api/analytics/*`, `/api/referrals`, `/api/stripe/*`
- Needs Node serverless, not a pure static export
- Vercel Hobby is free for personal projects (no paid add-ons required for demo mode)

## One-time: claim + connect Git (auto-deploy)

1. Open the **claim URL** above → create/sign in to Vercel (free).
2. In Vercel → Project → **Settings → Environment Variables**, optionally add:
   - `NEXT_PUBLIC_SITE_URL` = your `https://….vercel.app` URL
   - `SLOP_ADMIN_KEY` = a long random secret (enables admin write APIs)
   - Supabase / Stripe / PostHog / GA only if you use them (leave blank for demo mode)
3. Create a GitHub repo from Cursor (“Create repo”), then in Vercel: **Add Git Repository** → import that repo.
4. Production branch: `main`. Every push to `main` redeploys automatically.

### Update from iPhone (Cursor)

1. Ask Cursor to change the site and commit/push to `main`.
2. Wait for the Vercel deploy (usually under a minute).
3. Refresh Safari on the `*.vercel.app` URL — no localhost.

Without GitHub: from any machine with the repo, run `npx vercel --prod` while logged in (`npx vercel login`).

## Redeploy this temporary URL (agent / CLI)

```bash
npm run build
npx vercel deploy --temporary --yes
```

Then share the new URL + claim link from the CLI output.

## Production checklist

- [x] `npm run build` succeeds
- [x] Homepage, explore, watch, search, auth, admin, drama pages return 200
- [x] Sample MP4 `/videos/ep1-gilded.mp4` serves `video/mp4`
- [x] Analytics `POST /api/analytics/events` works
- [x] Admin write APIs locked on Vercel until `SLOP_ADMIN_KEY` is set
- [ ] Claim temporary deployment (you)
- [ ] Set `NEXT_PUBLIC_SITE_URL` after claim
- [ ] Optional: Supabase, Stripe, PostHog/GA4

## Secrets — never put in frontend

Do **not** expose in client code or `NEXT_PUBLIC_*`:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
- `SLOP_ADMIN_KEY`

Admin UI routes (`/admin/*`) still use the in-app demo admin session; mutating APIs additionally require `SLOP_ADMIN_KEY` on public Vercel.

## Optional services (still $0 until you enable paid tiers)

| Service | Needed for | Free path |
| --- | --- | --- |
| Supabase | Persistent auth/DB | Free project + run `supabase/migrations` |
| Stripe | Real $7.99 Premium | Free account; test mode; live only when you turn it on |
| PostHog / GA4 | External product analytics | Free tiers; app works without them |
| Custom domain | Brand URL | Skip — use `*.vercel.app` |

No paid services are required for the public demo.
