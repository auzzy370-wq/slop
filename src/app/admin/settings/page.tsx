"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSlopStore } from "@/store/slop-store";
import { toast } from "sonner";

export default function AdminSettingsPage() {
  const settings = useSlopStore((s) => s.settings);
  const updateSettings = useSlopStore((s) => s.updateSettings);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">
          Platform settings
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Branding, ads, registration, and feature flags. Sensitive changes must
          stay behind admin authorization.
        </p>
      </div>

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
            ["maintenanceMode", "Maintenance mode"],
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
          <a href="/admin/ads" className="font-semibold text-[var(--slop-violet)]">
            Ads
          </a>
          .
        </p>

        <Button onClick={() => toast.success("Settings saved locally")}>
          Save settings
        </Button>
      </div>
    </div>
  );
}
