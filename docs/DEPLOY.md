# Deploy SLOP (free public HTTPS)

SLOP is a **Next.js App Router** app with API routes (analytics, referrals, Stripe). It is **not** a static site. Hosted on **Vercel** (free Hobby tier).

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

Admin uploads already go to R2 when it is configured. The daily `/api/cron/migrate-blob` cron keeps copying any older Vercel Blob episodes across.

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
