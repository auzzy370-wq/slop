"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSlopStore } from "@/store/slop-store";
import { toast } from "sonner";

function adminHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (typeof window !== "undefined") {
    const key = window.localStorage.getItem("slop_admin_key");
    if (key) headers["x-slop-admin-key"] = key;
  }
  return headers;
}

export default function AdminSettingsPage() {
  const settings = useSlopStore((s) => s.settings);
  const updateSettings = useSlopStore((s) => s.updateSettings);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    "SLOP is temporarily down for maintenance. We’ll be back shortly.",
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/site-settings", {
          headers: adminHeaders(),
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setMaintenanceMode(Boolean(data.maintenanceMode));
          if (typeof data.maintenanceMessage === "string") {
            setMaintenanceMessage(data.maintenanceMessage);
          }
          updateSettings({
            maintenanceMode: Boolean(data.maintenanceMode),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [updateSettings]);

  const saveMaintenance = async () => {
    setSaving(true);
    const toastId = toast.loading("Saving maintenance settings…");
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          maintenanceMode,
          maintenanceMessage,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(
          data.message ||
            data.error ||
            "Save failed — paste SLOP_ADMIN_KEY on Mass upload first",
        );
      }
      updateSettings({ maintenanceMode: Boolean(data.maintenanceMode) });
      toast.success(data.message || "Saved", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed", {
        id: toastId,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Platform settings</h1>
        <p className="mt-1 text-sm text-white/50">
          Branding, feature flags, and site-wide maintenance.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
        <div>
          <h2 className="font-semibold text-amber-50">Maintenance mode</h2>
          <p className="mt-1 text-xs text-white/55">
            When ON, regular visitors see a full-screen “Under maintenance”
            page instead of the app. Admins can still open /admin and the rest
            of the site after signing in. This is saved on the server (not just
            your phone).
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={maintenanceMode}
            disabled={loading || saving}
            onChange={(e) => setMaintenanceMode(e.target.checked)}
          />
          <span>
            Enable maintenance mode
            <span className="mt-0.5 block text-xs text-white/45">
              {maintenanceMode
                ? "Public visitors are blocked (after you save)."
                : "Site is public for everyone."}
            </span>
          </span>
        </label>

        <label className="block text-xs uppercase tracking-wide text-white/45">
          Message shown to visitors
          <Textarea
            className="mt-1"
            rows={3}
            value={maintenanceMessage}
            disabled={loading || saving}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
          />
        </label>

        <Button disabled={loading || saving} onClick={() => void saveMaintenance()}>
          {saving ? "Saving…" : "Save maintenance settings"}
        </Button>
      </section>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <label className="block text-xs uppercase tracking-wide text-white/45">
          Site name
          <Input
            className="mt-1"
            value={settings.siteName}
            onChange={(e) => updateSettings({ siteName: e.target.value })}
          />
        </label>
        <label className="block text-xs uppercase tracking-wide text-white/45">
          Tagline
          <Input
            className="mt-1"
            value={settings.tagline}
            onChange={(e) => updateSettings({ tagline: e.target.value })}
          />
        </label>
        {(
          [
            ["commentsEnabled", "Allow comments"],
            ["registrationEnabled", "Allow registration"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) => updateSettings({ [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}

        <p className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/55">
          Ads on/off, frequency, and AdSense wiring live under{" "}
          <a
            href="/admin/ads"
            className="font-semibold text-[var(--slop-violet)]"
          >
            Ads
          </a>
          .
        </p>

        <Button
          variant="secondary"
          onClick={() => toast.success("Local branding flags saved on this device")}
        >
          Save local branding flags
        </Button>
      </div>
    </div>
  );
}
