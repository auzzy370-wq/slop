# Deploy SLOP

SLOP is a Next.js App Router app. Production target is **Cloudflare Workers** (OpenNext), free tier. Seed video and images stay on the existing R2 bucket. The previous host was Vercel (`https://slop-fawn.vercel.app`).

## Cloudflare Workers

Adapter: `@opennextjs/cloudflare` 1.20.18 with Next.js **16.4.5** (November 2026 security patch). Cache Components are off because that adapter does not run them safely on Workers yet.

### One-time account setup

```bash
npx wrangler login
```

This opens Cloudflare’s OAuth page. Use the account that should own the Worker. No token is stored in the repo.

### Build-time variables

`npm run deploy` and `npm run preview` run `next build` on your machine. These are inlined into the client bundle, so put them in `.env.local` (or export them) **before** that command. They are not read from `wrangler secret` during the build.

- `R2_PUBLIC_BASE_URL` — public read URL of the media bucket, no trailing slash
- `NEXT_PUBLIC_SITE_URL` — the Workers URL after the first deploy (update and rebuild once you have it)
- `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` — optional; `next.config.ts` copies `R2_PUBLIC_BASE_URL` when this is unset
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — only if you use Supabase
- `NEXT_PUBLIC_ADS_CLIENT_ID`, `NEXT_PUBLIC_ADS_PROVIDER`, `NEXT_PUBLIC_ADS_SLOT_FEED`, `NEXT_PUBLIC_ADS_SLOT_ID`, `NEXT_PUBLIC_ADS_TEST_MODE` — only if you use ads
- `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` — only if you use analytics

### Runtime secrets

Copy `.dev.vars.example` to `.dev.vars` for local preview. For production, set each name with `npx wrangler secret put <NAME>` (the CLI prompts for the value; do not pass it as a flag).

Required for playback and crons:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL`
- `CRON_SECRET` — long random string. Cron Triggers send `Authorization: Bearer <CRON_SECRET>` to `/api/cron/migrate-blob` (11:00 UTC) and `/api/cron/publish-scheduled` (00:05 UTC)

Required to unlock admin writes on the public Worker:

- `SLOP_ADMIN_KEY`

Only if you still have episodes on Vercel Blob to copy across:

- `BLOB_READ_WRITE_TOKEN`

Optional, same names as before:

- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`
- `DISCORD_WEBHOOK_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`
- `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN`, `SOCIAL_WEBHOOK_URL`
- `SOCIAL_AUTO_POST_EPISODES`, `SOCIAL_AUTO_POST_ENABLED`

`CLOUDFLARE_WORKER=1` is a plain var in `wrangler.jsonc`, not a secret. It marks the Worker as a public host so admin writes and cron routes stay locked unless the keys above are set.

### Commands

```bash
npm run preview   # OpenNext build, then wrangler dev (Workers runtime)
npm run deploy    # OpenNext build, then wrangler deploy
```

`npm run dev` is still the Node Next.js dev server on port 3456.

Do the R2 media upload below before the first production deploy, or playback 404s on the CDN.

## Previous Vercel host

## Live production URL

| Item | Value |
| --- | --- |
| **Public HTTPS** | **https://slop-fawn.vercel.app** |
| Vercel project | `slop15/slop` |
| Cost | $0 (Hobby) |

Open that URL in Safari. No localhost. Full app (watch, auth, admin, APIs).

## Redeploy from this agent

```bash
export PATH="$HOME/.local/bin:$PATH"
vercel whoami          # must show your account
vercel deploy --prod --yes
```

`NEXT_PUBLIC_SITE_URL` is already set to `https://slop-fawn.vercel.app` on Production.

## Optional env (Vercel → Project → Settings → Environment Variables)

- `SLOP_ADMIN_KEY` — long random secret (unlocks admin write APIs)
- Supabase / Stripe / PostHog / GA / social webhooks — only if you use them

## One-time: move seed media to R2

Vercel must not serve `public/videos`, `public/thumbnails`, `public/posters`, or `public/banners`. Those paths redirect to `R2_PUBLIC_BASE_URL` when that variable is set at **build** time. Run this before merging or deploying, from a checkout that can still see the files (or restore them from `origin/main`):

```bash
mkdir -p /tmp/slop-media
git archive origin/main public/videos public/thumbnails public/posters public/banners | tar -x -C /tmp/slop-media
# R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL
# in the shell or .env.local — never commit them
node scripts/upload-public-media-to-r2.mjs --root /tmp/slop-media/public
```

Confirm one object in a browser, for example `{R2_PUBLIC_BASE_URL}/videos/blood-contract-ep1.mp4`. The bucket (or custom domain behind `R2_PUBLIC_BASE_URL`) has to be publicly readable. `R2_PUBLIC_BASE_URL` must be available to Production and Preview **builds**, not only runtime — the catalog and the redirects inline it.

Admin uploads already go to R2 when it is configured. The Cloudflare cron `/api/cron/migrate-blob` (11:00 UTC) keeps copying any older Vercel Blob episodes across when `BLOB_READ_WRITE_TOKEN` is set.

## Production checklist

- [x] `npm run build` succeeds
- [x] Vercel project linked (`slop15/slop`)
- [x] Production alias live: `https://slop-fawn.vercel.app`
- [x] Deployment Protection (SSO) disabled for public access
- [x] `NEXT_PUBLIC_SITE_URL` set on Production
- [ ] Optional: Supabase, Stripe, PostHog/GA4, social auto-post credentials

## Secrets — never put in frontend

Do **not** expose in client code or `NEXT_PUBLIC_*`:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
- `SLOP_ADMIN_KEY`
