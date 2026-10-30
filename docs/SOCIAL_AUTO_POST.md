# Social auto-post (Ep 1 & 2)

When an admin **publishes episode 1 or 2** of a show, SLOP automatically posts a caption + watch link to every connected channel.

## Flow

1. Admin opens **Episodes** → set status to **Published** (checkbox *Auto-post Ep 1–2* on).
2. Client calls `POST /api/social/auto-post`.
3. Server posts to configured channels, logs results under `data/social-posts.json` (or `/tmp` on Vercel).
4. Activity shows in **Admin → Social**.

Idempotent: the same episode won’t re-post to a channel that already succeeded (unless you force a test post).

## Env vars

| Variable | Purpose |
| --- | --- |
| `SOCIAL_AUTO_POST_ENABLED` | `true` / `false` (default on) |
| `SOCIAL_AUTO_POST_EPISODES` | Comma list, default `1,2` |
| `NEXT_PUBLIC_SITE_URL` | Public HTTPS base for watch links |
| `DISCORD_WEBHOOK_URL` | Free Discord channel webhook |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Free Telegram bot |
| `TWITTER_API_KEY` + `TWITTER_API_SECRET` + `TWITTER_ACCESS_TOKEN` + `TWITTER_ACCESS_SECRET` | X posting |
| `FACEBOOK_PAGE_ID` + `FACEBOOK_PAGE_ACCESS_TOKEN` | Facebook Page feed |
| `SOCIAL_WEBHOOK_URL` | Zapier/Make/n8n → Instagram, TikTok, etc. |

Never put these secrets in frontend code.

## Quickest free setup

1. Discord server → channel → Integrations → Webhooks → copy URL → `DISCORD_WEBHOOK_URL`.
2. Set `NEXT_PUBLIC_SITE_URL` to your public site.
3. Publish Ep 1 of any drama → check Discord + **Admin → Social** log.

## Instagram / TikTok

Those networks don’t give a simple free server-side “post video” API for apps like this. Use `SOCIAL_WEBHOOK_URL` into Zapier/Make and connect their Instagram/TikTok actions there (often free-tier limited).
