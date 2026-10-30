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
