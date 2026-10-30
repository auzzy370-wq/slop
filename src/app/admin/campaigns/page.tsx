"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useSlopStore } from "@/store/slop-store";

type CampaignRow = {
  id: string;
  name: string;
  platform: string;
  active: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  links: {
    id: string;
    code: string;
    label: string;
    clickCount: number;
    url: string;
    active: boolean;
  }[];
};

const PLATFORMS = [
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "google",
  "creator",
  "affiliate",
  "other",
];

export default function CampaignsAdminPage() {
  const user = useSlopStore((s) => s.currentUser);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [form, setForm] = useState({
    name: "",
    platform: "tiktok",
    notes: "",
    destinationPath: "/",
  });

  const load = async () => {
    const res = await fetch("/api/analytics/campaigns");
    const json = await res.json();
    setCampaigns(json.campaigns ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    if (!form.name.trim()) {
      toast.error("Name required");
      return;
    }
    const res = await fetch("/api/analytics/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        utmSource: form.platform,
        utmMedium: form.platform === "google" ? "cpc" : "social",
        utmCampaign: form.name.toLowerCase().replace(/\s+/g, "_"),
        actorId: user?.id,
      }),
    });
    if (!res.ok) {
      toast.error("Could not create campaign");
      return;
    }
    toast.success("Campaign + tracking link created");
    setForm({ name: "", platform: "tiktok", notes: "", destinationPath: "/" });
    void load();
  };

  const toggle = async (id: string, active: boolean) => {
    await fetch("/api/analytics/campaigns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active, actorId: user?.id }),
    });
    void load();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Campaigns</h1>
        <p className="mt-1 text-sm text-[var(--slop-slate)]">
          Create UTM tracking links for Facebook, Instagram, TikTok, YouTube,
          Google, creators, and affiliates. Clicks and conversions are recorded
          from real visits.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-semibold">New campaign</h2>
        <Input
          placeholder="Campaign name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <select
          className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm"
          value={form.platform}
          onChange={(e) => setForm({ ...form, platform: e.target.value })}
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <Input
          placeholder="Destination path (e.g. /drama/the-unsent-message)"
          value={form.destinationPath}
          onChange={(e) =>
            setForm({ ...form, destinationPath: e.target.value })
          }
        />
        <Textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <Button onClick={create}>Create campaign</Button>
      </section>

      <div className="space-y-3">
        {campaigns.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl border border-white/10 bg-black/30 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-[var(--slop-slate)]">
                  {c.platform} · {c.utmSource}/{c.utmMedium}/{c.utmCampaign}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggle(c.id, !c.active)}
              >
                {c.active ? "Disable" : "Enable"}
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {c.links.map((l) => (
                <div
                  key={l.id}
                  className="rounded-xl bg-white/5 p-3 text-xs"
                >
                  <p className="font-medium text-white">{l.label}</p>
                  <p className="mt-1 break-all text-[var(--slop-lavender)]">
                    {l.url}
                  </p>
                  <p className="mt-1 text-[var(--slop-slate)]">
                    code={l.code} · clicks={l.clickCount}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-[var(--slop-violet)]"
                    onClick={async () => {
                      await navigator.clipboard.writeText(l.url);
                      toast.success("Link copied");
                    }}
                  >
                    Copy link
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {campaigns.length === 0 && (
          <p className="text-sm text-[var(--slop-slate)]">
            No campaigns yet. Create one to generate a trackable URL.
          </p>
        )}
      </div>
    </div>
  );
}
