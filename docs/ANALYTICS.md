# SLOP Analytics, Attribution, Revenue & Referrals

## Features implemented

1. **Central event pipeline** — `POST /api/analytics/events` records product events to a durable local store (`data/analytics-store.json`) with idempotency keys. Optional fan-out to PostHog + GA4 when env keys are set.
2. **Consent-aware tracking** — banner + opt-out; non-critical events suppressed when consent is denied. Critical payment/registration events still recorded server-side.
3. **Attribution** — UTM + referrer + `?ref=` + `?c=` tracking codes. First-touch preserved; last-touch updated on new evidence. Sources: facebook, instagram, tiktok, youtube, google, direct, organic_search, paid, creator/affiliate referral, external, referral, unknown.
4. **Campaigns** — Admin create/disable campaigns and unique tracking links with auto UTM params (`/admin/campaigns`).
5. **Owner analytics** — `/admin/analytics` traffic + acquisition, `/admin/analytics/content` episode performance, `/admin/analytics/revenue` revenue + ad import.
6. **Video analytics** — playback sessions with start/progress/pause/complete/abandon; 25/50/75/100% markers; heartbeat progress does not create extra starts.
7. **Revenue** — subscription events from demo checkout + Stripe webhook hooks; ad revenue only via explicit import (never invented from impressions).
8. **SLOP Rewards** — unique referral codes/URLs, click + registration attribution, qualification (email verify + watch minutes), configurable reward rules, redeem flow, fraud flags (self-ref, burst), admin review/revoke.
9. **Exports** — CSV via `/api/analytics/export?type=traffic|acquisition|content|revenue|referrals|campaigns`.
10. **SQL** — `supabase/migrations/002_analytics_referrals.sql` for production Postgres/RLS.

## Services

| Service | Role | Required? |
| --- | --- | --- |
| Local analytics store | Authoritative events in demo / single-node | Yes (default) |
| Supabase | Production tables + RLS | When deploying DB |
| PostHog | Product analytics mirror | Optional |
| GA4 | Acquisition reporting mirror | Optional |
| Stripe webhooks | Payment truth | When billing live |

## Environment variables

See `.env.example`:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- Existing Supabase + Stripe vars

## Account setup

1. (Optional) Create a PostHog project → paste project API key.
2. (Optional) Create a GA4 property → paste Measurement ID.
3. Apply migration `002_analytics_referrals.sql` in Supabase when moving off the file store.
4. Point Stripe webhook to `/api/stripe/webhook`.

## Deployment notes

- Ensure the host can persist `data/` **or** migrate the store layer to Supabase using the migration schema.
- Never seed fake sessions/users/views for dashboards or public counters. Catalog `viewCount` / admin overview cards start at **0** and only rise from recorded playback/session events. Empty zeros mean no events yet.
- Admin routes remain client-gated by `role === "admin"` (demo). Harden with server auth when Supabase Auth is connected.

## Testing checklist (run locally)

- [ ] Visit `/?utm_source=tiktok&utm_medium=social&utm_campaign=test` → session first-touch = tiktok
- [ ] Visit `/?ref=CODE` after creating a user referral code → referral click recorded
- [ ] Register new account with stored ref → relationship created; self-ref blocked
- [ ] Play episode on `/watch` → playback session + completion markers
- [ ] Admin Analytics shows non-zero only after real events
- [ ] Import ad revenue → revenue dashboard updates; unlabeled estimates flagged
- [ ] Demo Premium checkout → subscription event + optional premium referral qualify
- [ ] Duplicate idempotency key → no duplicate event
- [ ] Opt out of consent → page views stop recording
- [ ] Non-admin cannot open `/admin/analytics` (redirects to sign-in)

## Limitations

- File-backed store is for single-node / Cloud Agent demo; use Supabase tables for multi-instance production.
- Demo email verification is auto-called on sign-up for local qualification testing — wire real Supabase email confirm in production and remove the auto-verify call.
- Stripe webhook user mapping depends on Checkout `metadata.userId`.
- Active-visitor count uses last-seen within 5 minutes of recorded sessions only.
