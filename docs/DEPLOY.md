# Deploy SLOP (free public HTTPS)

SLOP is a **Next.js App Router** app with API routes (analytics, referrals, Stripe). It is **not** a static site. Host on **Vercel** (free Hobby tier) for a permanent URL.

## Use this URL on your iPhone right now

Anonymous Vercel `*.tmp.now` links are often **blocked with 403** on mobile networks (Vercel bot protection). Use the Cloudflare tunnel instead:

| Item | Value |
| --- | --- |
| **Public HTTPS (works in Safari)** | https://kathy-epa-back-repeat.trycloudflare.com |
| Hosting path | Cloudflare Quick Tunnel → production Next.js on this agent |
| Cost | $0 |

Open that URL in Safari. No localhost. Full app (watch, auth, admin, APIs).

> This tunnel stays up while the Cursor cloud agent session is running. For a permanent URL that survives after the agent stops, complete the Vercel steps below.

## Permanent free hosting (Vercel Hobby) — required once

Do **not** rely on anonymous `*.tmp.now` deploys from a phone; they frequently return:

`403 FORBIDDEN` / `This request was blocked` (Vercel edge protection on unclaimed temp URLs).

### Option A — Vercel dashboard (easiest from iPhone)

1. Create a free account at [https://vercel.com/signup](https://vercel.com/signup) ($0 Hobby).
2. In Cursor, use **Create repo** so the project is on GitHub (or connect the Origin remote if you prefer CLI).
3. In Vercel → **Add New Project** → import that Git repo.
4. Framework preset: **Next.js**. Build: `npm run build`. Output: default.
5. Deploy. You get `https://<name>.vercel.app` — open that in Safari.
6. (Optional) Project → Settings → Environment Variables:
   - `NEXT_PUBLIC_SITE_URL` = `https://<name>.vercel.app`
   - `SLOP_ADMIN_KEY` = a long random secret (unlocks admin write APIs)
   - Supabase / Stripe / PostHog / GA only if you use them

Every push to `main` auto-redeploys.

### Option B — CLI after you log in once

```bash
npx vercel login          # approve on phone/email
npx vercel --prod         # prints https://….vercel.app
```

### Why not Cloudflare Pages / Netlify static?

- Needs `/api/analytics/*`, `/api/referrals`, `/api/stripe/*` (Node serverless).
- Pure static export would break those features.
- Netlify/Cloudflare Workers can host Next.js too, but need a free account + adapter; Vercel is the least friction for this stack.

## Update from iPhone (Cursor)

1. Ask Cursor to change the site and commit/push to `main`.
2. Wait for the Vercel deploy (usually under a minute).
3. Refresh Safari on your `*.vercel.app` URL.

While using only the Cloudflare tunnel (no Vercel yet): ask Cursor to apply changes here; the tunnel serves the live production server immediately after rebuild/restart.

## Production checklist

- [x] `npm run build` succeeds
- [x] Cloudflare tunnel homepage / explore / watch / drama / video / APIs return 200
- [x] Admin write APIs lock on Vercel until `SLOP_ADMIN_KEY` is set
- [ ] Create free Vercel account + import repo (you) → permanent `*.vercel.app`
- [ ] Set `NEXT_PUBLIC_SITE_URL` after first permanent deploy
- [ ] Optional: Supabase, Stripe, PostHog/GA4

## Secrets — never put in frontend

Do **not** expose in client code or `NEXT_PUBLIC_*`:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
- `SLOP_ADMIN_KEY`
