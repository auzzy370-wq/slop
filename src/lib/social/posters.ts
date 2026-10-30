import { absoluteAssetUrl, composeCaption, watchUrlFor } from "./compose";
import { oauth1Header } from "./oauth1";
import type {
  SocialAutoPostPayload,
  SocialChannel,
  SocialChannelResult,
} from "./types";

function configuredChannels(): SocialChannel[] {
  const channels: SocialChannel[] = [];
  if (process.env.DISCORD_WEBHOOK_URL) channels.push("discord");
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    channels.push("telegram");
  }
  if (
    process.env.TWITTER_API_KEY &&
    process.env.TWITTER_API_SECRET &&
    process.env.TWITTER_ACCESS_TOKEN &&
    process.env.TWITTER_ACCESS_SECRET
  ) {
    channels.push("twitter");
  }
  if (process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
    channels.push("facebook");
  }
  if (process.env.SOCIAL_WEBHOOK_URL) channels.push("webhook");
  return channels;
}

export function listConfiguredChannels() {
  return configuredChannels();
}

export async function postToConfiguredChannels(
  payload: SocialAutoPostPayload,
  onlyChannels?: SocialChannel[],
): Promise<{ caption: string; watchUrl: string; results: SocialChannelResult[] }> {
  const caption = composeCaption(payload);
  const watchUrl = watchUrlFor(payload);
  let channels = configuredChannels();
  if (onlyChannels?.length) {
    channels = channels.filter((c) => onlyChannels.includes(c));
  }

  if (channels.length === 0) {
    return {
      caption,
      watchUrl,
      results: [
        {
          channel: "webhook",
          status: "skipped",
          error:
            "No social credentials configured. Set DISCORD_WEBHOOK_URL, TELEGRAM_*, TWITTER_*, FACEBOOK_*, or SOCIAL_WEBHOOK_URL.",
        },
      ],
    };
  }

  const results: SocialChannelResult[] = [];
  for (const channel of channels) {
    try {
      if (channel === "discord")
        results.push(await postDiscord(payload, caption, watchUrl));
      else if (channel === "telegram")
        results.push(await postTelegram(payload, caption));
      else if (channel === "twitter") results.push(await postTwitter(caption));
      else if (channel === "facebook")
        results.push(await postFacebook(payload, caption, watchUrl));
      else if (channel === "webhook")
        results.push(await postWebhook(payload, caption, watchUrl));
    } catch (err) {
      results.push({
        channel,
        status: "failed",
        error: err instanceof Error ? err.message : "unknown_error",
      });
    }
  }
  return { caption, watchUrl, results };
}

async function postDiscord(
  payload: SocialAutoPostPayload,
  caption: string,
  watchUrl: string,
): Promise<SocialChannelResult> {
  const url = process.env.DISCORD_WEBHOOK_URL!;
  const thumb = absoluteAssetUrl(payload.thumbnailUrl);
  const body = {
    content: `**New SLOP drop** · Ep ${payload.episodeNumber}`,
    embeds: [
      {
        title: `${payload.dramaTitle} — ${payload.episodeTitle}`,
        description: (payload.description || caption).slice(0, 400),
        url: watchUrl,
        color: 0xb99aff,
        image: thumb ? { url: thumb } : undefined,
        footer: { text: "SLOP · Stories That Keep You Watching" },
      },
    ],
  };
  const res = await fetch(`${url}?wait=true`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      channel: "discord",
      status: "failed",
      error: `discord_${res.status}: ${text.slice(0, 200)}`,
    };
  }
  const json = (await res.json().catch(() => ({}))) as { id?: string };
  return {
    channel: "discord",
    status: "posted",
    externalId: json.id ?? null,
    detail: "Discord webhook message sent",
  };
}

async function postTelegram(
  payload: SocialAutoPostPayload,
  caption: string,
): Promise<SocialChannelResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chatId = process.env.TELEGRAM_CHAT_ID!;
  const thumb = absoluteAssetUrl(payload.thumbnailUrl);
  const endpoint = thumb
    ? `https://api.telegram.org/bot${token}/sendPhoto`
    : `https://api.telegram.org/bot${token}/sendMessage`;
  const body = thumb
    ? {
        chat_id: chatId,
        photo: thumb,
        caption: caption.slice(0, 1024),
        parse_mode: "HTML",
      }
    : {
        chat_id: chatId,
        text: caption,
        disable_web_page_preview: false,
      };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: { message_id?: number };
    description?: string;
  };
  if (!res.ok || !json.ok) {
    return {
      channel: "telegram",
      status: "failed",
      error: json.description || `telegram_${res.status}`,
    };
  }
  return {
    channel: "telegram",
    status: "posted",
    externalId: json.result?.message_id
      ? String(json.result.message_id)
      : null,
  };
}

async function postTwitter(caption: string): Promise<SocialChannelResult> {
  const url = "https://api.twitter.com/2/tweets";
  const text = caption.length > 270 ? `${caption.slice(0, 267)}...` : caption;
  const auth = oauth1Header({
    method: "POST",
    url,
    consumerKey: process.env.TWITTER_API_KEY!,
    consumerSecret: process.env.TWITTER_API_SECRET!,
    token: process.env.TWITTER_ACCESS_TOKEN!,
    tokenSecret: process.env.TWITTER_ACCESS_SECRET!,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: auth,
      "content-type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { id?: string };
    detail?: string;
    title?: string;
  };
  if (!res.ok) {
    return {
      channel: "twitter",
      status: "failed",
      error: json.detail || json.title || `twitter_${res.status}`,
    };
  }
  return {
    channel: "twitter",
    status: "posted",
    externalId: json.data?.id ?? null,
  };
}

async function postFacebook(
  payload: SocialAutoPostPayload,
  caption: string,
  watchUrl: string,
): Promise<SocialChannelResult> {
  const pageId = process.env.FACEBOOK_PAGE_ID!;
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN!;
  const endpoint = `https://graph.facebook.com/v21.0/${pageId}/feed`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: caption,
      link: watchUrl,
      access_token: token,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };
  if (!res.ok || json.error) {
    return {
      channel: "facebook",
      status: "failed",
      error: json.error?.message || `facebook_${res.status}`,
    };
  }
  return {
    channel: "facebook",
    status: "posted",
    externalId: json.id ?? null,
  };
}

async function postWebhook(
  payload: SocialAutoPostPayload,
  caption: string,
  watchUrl: string,
): Promise<SocialChannelResult> {
  const url = process.env.SOCIAL_WEBHOOK_URL!;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-slop-event": "episode.auto_post",
    },
    body: JSON.stringify({
      event: "episode.auto_post",
      caption,
      watchUrl,
      drama: {
        id: payload.dramaId,
        title: payload.dramaTitle,
        slug: payload.dramaSlug,
      },
      episode: {
        id: payload.episodeId,
        number: payload.episodeNumber,
        title: payload.episodeTitle,
        slug: payload.episodeSlug,
        thumbnailUrl: absoluteAssetUrl(payload.thumbnailUrl),
        videoUrl: absoluteAssetUrl(payload.videoUrl),
      },
      postedAt: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      channel: "webhook",
      status: "failed",
      error: `webhook_${res.status}: ${text.slice(0, 200)}`,
    };
  }
  return {
    channel: "webhook",
    status: "posted",
    detail: "Forwarded to SOCIAL_WEBHOOK_URL (Zapier/Make/n8n)",
  };
}
