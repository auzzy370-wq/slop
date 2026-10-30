"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { triggerEpisodeAutoPost } from "@/lib/social/client";
import { useSlopStore } from "@/store/slop-store";
import { toast } from "sonner";

type Status = {
  enabled: boolean;
  episodeNumbers: number[];
  configuredChannels: string[];
  siteUrl: string;
  recentPosts: {
    id: string;
    dramaId: string;
    episodeId: string;
    episodeNumber: number;
    channel: string;
    status: string;
    caption: string;
    watchUrl: string;
    error?: string | null;
    createdAt: string;
  }[];
};

export default function AdminSocialPage() {
  const videos = useSlopStore((s) => s.videos);
  const dramas = useSlopStore((s) => s.dramas);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/social/auto-post");
      const json = await res.json();
      setStatus(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const testPost = async () => {
    const ep =
      videos.find((v) => v.status === "published" && v.episodeNumber === 1) ||
      videos.find((v) => v.status === "published");
    const drama = ep ? dramas.find((d) => d.id === ep.dramaId) : null;
    if (!ep || !drama) {
      toast.error("Publish at least one episode first");
      return;
    }
    const toastId = toast.loading("Sending test auto-post…");
    const result = await triggerEpisodeAutoPost({
      dramaId: drama.id,
      dramaTitle: drama.title,
      dramaSlug: drama.slug,
      episodeId: ep.id,
      episodeNumber: ep.episodeNumber,
      episodeTitle: ep.title,
      episodeSlug: ep.slug,
      description: ep.description,
      thumbnailUrl: ep.thumbnailUrl,
      videoUrl: ep.videoUrl,
      force: true,
    });
    await load();
    if (result.skipped) {
      toast.message(result.message || "Skipped", { id: toastId });
    } else if (result.ok) {
      toast.success(result.message || "Posted", { id: toastId });
    } else {
      toast.error(result.message || "Failed", { id: toastId });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Social auto-post</h1>
        <p className="mt-1 text-sm text-white/50">
          When you publish <strong>episode 1 or 2</strong> of a show, SLOP
          automatically posts a watch link + caption to every connected social
          channel.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-white/45">Loading social status…</p>
      )}

      {status && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wide text-white/45">
              Auto-post
            </p>
            <p className="mt-2 font-display text-2xl font-bold">
              {status.enabled ? "On" : "Off"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wide text-white/45">
              Episodes
            </p>
            <p className="mt-2 font-display text-2xl font-bold">
              {status.episodeNumbers.join(" & ") || "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wide text-white/45">
              Channels connected
            </p>
            <p className="mt-2 font-display text-2xl font-bold">
              {status.configuredChannels.length}
            </p>
            <p className="mt-1 text-[11px] text-white/35">
              {status.configuredChannels.length
                ? status.configuredChannels.join(", ")
                : "None yet"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wide text-white/45">
              Public site URL
            </p>
            <p className="mt-2 truncate text-sm font-semibold">
              {status.siteUrl}
            </p>
          </div>
        </div>
      )}

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-semibold">Connect channels (env vars)</h2>
        <p className="text-sm text-white/50">
          Free options work fine. Add any of these to{" "}
          <code className="text-[var(--slop-violet)]">.env.local</code> / Vercel
          env, then redeploy. Secrets never go in frontend code.
        </p>
        <ul className="space-y-2 text-sm text-white/70">
          <li>
            <strong className="text-white">Discord</strong> —{" "}
            <code>DISCORD_WEBHOOK_URL</code> (server Settings → Integrations →
            Webhooks). Free.
          </li>
          <li>
            <strong className="text-white">Telegram</strong> —{" "}
            <code>TELEGRAM_BOT_TOKEN</code> + <code>TELEGRAM_CHAT_ID</code>{" "}
            (@BotFather). Free.
          </li>
          <li>
            <strong className="text-white">X / Twitter</strong> —{" "}
            <code>TWITTER_API_KEY</code>, <code>TWITTER_API_SECRET</code>,{" "}
            <code>TWITTER_ACCESS_TOKEN</code>, <code>TWITTER_ACCESS_SECRET</code>{" "}
            (developer portal free tier).
          </li>
          <li>
            <strong className="text-white">Facebook Page</strong> —{" "}
            <code>FACEBOOK_PAGE_ID</code> +{" "}
            <code>FACEBOOK_PAGE_ACCESS_TOKEN</code>.
          </li>
          <li>
            <strong className="text-white">Zapier / Make / n8n</strong> —{" "}
            <code>SOCIAL_WEBHOOK_URL</code> receives JSON and can fan out to
            Instagram, TikTok, etc.
          </li>
        </ul>
        <p className="text-xs text-white/40">
          Also set <code>NEXT_PUBLIC_SITE_URL</code> to your public HTTPS URL so
          posts include a working watch link. Optional:{" "}
          <code>SOCIAL_AUTO_POST_EPISODES=1,2</code> and{" "}
          <code>SOCIAL_AUTO_POST_ENABLED=true</code>.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={() => void testPost()}>Send test post</Button>
          <Button variant="secondary" onClick={() => void load()}>
            Refresh log
          </Button>
          <Link
            href="/admin/videos"
            className="inline-flex h-11 items-center rounded-xl border border-white/20 px-5 text-sm font-semibold"
          >
            Publish episodes
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/45">
          Recent auto-posts
        </h2>
        <div className="space-y-2">
          {(status?.recentPosts?.length ?? 0) === 0 && (
            <p className="text-sm text-white/45">
              No auto-posts yet. Publish Ep 1 or Ep 2 of a show to trigger one.
            </p>
          )}
          {status?.recentPosts?.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  Ep {p.episodeNumber} · {p.channel} ·{" "}
                  <span
                    className={
                      p.status === "posted"
                        ? "text-emerald-400"
                        : p.status === "failed"
                          ? "text-red-400"
                          : "text-white/50"
                    }
                  >
                    {p.status}
                  </span>
                </p>
                <p className="text-xs text-white/35">
                  {new Date(p.createdAt).toLocaleString()}
                </p>
              </div>
              {p.error ? (
                <p className="mt-1 text-xs text-red-300/80">{p.error}</p>
              ) : null}
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-white/55">
                {p.caption}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
