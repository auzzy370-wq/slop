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
        <label className="block text-xs uppercase tracking-wide text-white/45">
          Ad every N videos
          <Input
            className="mt-1"
            type="number"
            min={2}
            max={20}
            value={settings.adPlacementEvery}
            onChange={(e) =>
              updateSettings({
                adPlacementEvery: Math.max(2, Number(e.target.value) || 4),
              })
            }
          />
        </label>

        {(
          [
            ["adsEnabled", "Show ads to free users"],
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

        <Button onClick={() => toast.success("Settings saved locally")}>
          Save settings
        </Button>
      </div>
    </div>
  );
}
