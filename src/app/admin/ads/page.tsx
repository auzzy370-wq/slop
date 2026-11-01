"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink, Megaphone } from "lucide-react";
import { getAdsPublicConfig } from "@/lib/ads/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSlopStore } from "@/store/slop-store";
import { toast } from "sonner";

function Step({
  done,
  title,
  children,
}: {
  done: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
      ) : (
        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-white/30" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white">{title}</p>
        <div className="mt-1 text-sm text-white/55">{children}</div>
      </div>
    </li>
  );
}

export default function AdminAdsPage() {
  const settings = useSlopStore((s) => s.settings);
  const updateSettings = useSlopStore((s) => s.updateSettings);
  const ads = getAdsPublicConfig();

  const statusLabel =
    !settings.adsEnabled
      ? "Ads disabled in settings"
      : ads.provider === "adsense" && ads.configured
        ? "AdSense live"
        : ads.provider === "adsense"
          ? "AdSense selected — missing env vars"
          : "House ads (Premium CTA)";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--slop-violet)]">
          Monetization
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">Ads</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Free viewers see a full-screen placement between episodes. Premium
          skips them. Until AdSense is approved and wired, SLOP shows a house
          ad that upsells Premium.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">
            Status
          </p>
          <p className="mt-2 font-display text-xl font-bold">{statusLabel}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">
            Provider
          </p>
          <p className="mt-2 font-display text-xl font-bold capitalize">
            {ads.provider}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">
            Frequency
          </p>
          <p className="mt-2 font-display text-xl font-bold">
            Every {settings.adPlacementEvery} episodes
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Setup checklist</h2>
        <ol className="space-y-3">
          <Step done={settings.adsEnabled} title="Turn ads on for free users">
            <label className="mt-2 flex items-center gap-2 text-white/80">
              <input
                type="checkbox"
                checked={settings.adsEnabled}
                onChange={(e) =>
                  updateSettings({ adsEnabled: e.target.checked })
                }
              />
              Show ads to free users (Premium never sees them)
            </label>
          </Step>

          <Step done title="Choose placement frequency">
            <label className="mt-2 block text-xs uppercase tracking-wide text-white/45">
              Ad every N videos
              <Input
                className="mt-1 max-w-[10rem]"
                type="number"
                min={2}
                max={20}
                value={settings.adPlacementEvery}
                onChange={(e) =>
                  updateSettings({
                    adPlacementEvery: Math.max(
                      2,
                      Number(e.target.value) || 4,
                    ),
                  })
                }
              />
            </label>
            <p className="mt-2 text-xs text-white/40">
              Lower = more ads. Start around 4–6 so the feed still feels
              bingeable.
            </p>
          </Step>

          <Step
            done={Boolean(ads.clientId)}
            title="Create a Google AdSense account"
          >
            <p>
              Apply at{" "}
              <a
                href="https://www.google.com/adsense/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[var(--slop-violet)]"
              >
                google.com/adsense <ExternalLink className="h-3 w-3" />
              </a>
              . Add site <code className="text-white/80">slop-fawn.vercel.app</code>{" "}
              (or your custom domain). Approval can take a few days.
            </p>
          </Step>

          <Step
            done={Boolean(ads.clientId && ads.feedSlotId)}
            title="Create a Display ad unit"
          >
            <p>
              In AdSense → Ads → By ad unit → Display. Use responsive / fluid.
              Copy the <strong>client</strong> (<code>ca-pub-…</code>) and{" "}
              <strong>slot</strong> id.
            </p>
          </Step>

          <Step
            done={ads.provider === "adsense" && ads.configured}
            title="Add env vars on Vercel"
          >
            <p className="mb-2">
              Project → Settings → Environment Variables → Production:
            </p>
            <pre className="overflow-x-auto rounded-xl bg-black/50 p-3 text-[11px] leading-relaxed text-[var(--slop-lavender)]">
{`NEXT_PUBLIC_ADS_PROVIDER=adsense
NEXT_PUBLIC_ADS_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
NEXT_PUBLIC_ADS_SLOT_FEED=##########
# Optional while testing:
# NEXT_PUBLIC_ADS_TEST_MODE=true`}
            </pre>
            <p className="mt-2 text-xs text-white/40">
              Redeploy after saving. Until these are set, the feed keeps showing
              house ads.
            </p>
          </Step>

          <Step done title="Verify ads.txt">
            <p>
              SLOP serves{" "}
              <Link
                href="/ads.txt"
                className="text-[var(--slop-violet)]"
                target="_blank"
              >
                /ads.txt
              </Link>{" "}
              automatically from your publisher id when AdSense env is set.
              AdSense needs this for authorization.
            </p>
          </Step>
        </ol>
      </section>

      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <Megaphone className="h-5 w-5 text-[var(--slop-violet)]" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Revenue import</p>
          <p className="text-sm text-white/50">
            Paste daily AdSense totals into Analytics → Revenue so dashboards
            stay honest (no invented RPM).
          </p>
        </div>
        <Link
          href="/admin/analytics/revenue"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Open revenue
        </Link>
        <Button
          variant="secondary"
          onClick={() => {
            updateSettings({
              adsEnabled: settings.adsEnabled,
              adPlacementEvery: settings.adPlacementEvery,
            });
            toast.success("Ad settings saved on this device");
          }}
        >
          Save
        </Button>
      </section>
    </div>
  );
}
