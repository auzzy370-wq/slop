import { uid } from "@/lib/utils";
import {
  allowedEpisodeNumbers,
  autoPostEnabled,
  composeCaption,
  watchUrlFor,
} from "./compose";
import { listConfiguredChannels, postToConfiguredChannels } from "./posters";
import { alreadyPosted, readSocialStore, updateSocialStore } from "./store";
import type {
  SocialAutoPostPayload,
  SocialChannel,
  SocialChannelResult,
} from "./types";

export async function getSocialStatus() {
  const store = await readSocialStore();
  return {
    enabled: autoPostEnabled(),
    episodeNumbers: allowedEpisodeNumbers(),
    configuredChannels: listConfiguredChannels(),
    recentPosts: store.posts.slice(0, 40),
    siteUrl:
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "http://localhost:3456",
  };
}

export async function runEpisodeAutoPost(payload: SocialAutoPostPayload) {
  if (!autoPostEnabled() && !payload.force) {
    return {
      ok: false as const,
      skipped: true as const,
      reason: "disabled",
      message:
        "Social auto-post is disabled. Set SOCIAL_AUTO_POST_ENABLED=true.",
      results: [] as SocialChannelResult[],
    };
  }

  const allowed = allowedEpisodeNumbers();
  if (!allowed.includes(payload.episodeNumber) && !payload.force) {
    return {
      ok: true as const,
      skipped: true as const,
      reason: "episode_not_in_auto_range",
      message: `Only episodes ${allowed.join(" & ")} auto-post when published.`,
      results: [] as SocialChannelResult[],
    };
  }

  const channels = listConfiguredChannels();
  const pending: SocialChannel[] = [];
  for (const ch of channels) {
    if (payload.force || !(await alreadyPosted(payload.episodeId, ch))) {
      pending.push(ch);
    }
  }

  if (channels.length === 0) {
    const caption = composeCaption(payload);
    const watchUrl = watchUrlFor(payload);
    await updateSocialStore((s) => {
      s.posts.unshift({
        id: uid("spost"),
        dramaId: payload.dramaId,
        episodeId: payload.episodeId,
        episodeNumber: payload.episodeNumber,
        channel: "webhook",
        status: "skipped",
        caption,
        watchUrl,
        error: "no_channels_configured",
        createdAt: new Date().toISOString(),
      });
      s.posts = s.posts.slice(0, 200);
    });
    return {
      ok: true as const,
      skipped: true as const,
      reason: "no_channels",
      message:
        "Ep 1–2 will auto-post once you add Discord / Telegram / X / Facebook / webhook credentials in env.",
      caption,
      watchUrl,
      results: [] as SocialChannelResult[],
    };
  }

  if (pending.length === 0) {
    return {
      ok: true as const,
      skipped: true as const,
      reason: "already_posted",
      message: "Already auto-posted this episode to every configured channel.",
      results: [] as SocialChannelResult[],
    };
  }

  const { caption, watchUrl, results } = await postToConfiguredChannels(
    payload,
    pending,
  );

  await updateSocialStore((s) => {
    for (const result of results) {
      s.posts.unshift({
        id: uid("spost"),
        dramaId: payload.dramaId,
        episodeId: payload.episodeId,
        episodeNumber: payload.episodeNumber,
        channel: result.channel,
        status: result.status,
        caption,
        watchUrl,
        externalId: result.externalId ?? null,
        error: result.error ?? null,
        createdAt: new Date().toISOString(),
      });
    }
    s.posts = s.posts.slice(0, 200);
  });

  const posted = results.filter((r) => r.status === "posted").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return {
    ok: failed === 0,
    skipped: false as const,
    caption,
    watchUrl,
    results,
    summary: { posted, failed, channels: results.length },
    message:
      posted > 0
        ? `Posted Ep ${payload.episodeNumber} to ${posted} channel(s).`
        : failed > 0
          ? `Auto-post attempted but ${failed} channel(s) failed.`
          : "No posts sent.",
  };
}
