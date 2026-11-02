"use client";

import { Play } from "lucide-react";
import type { Video } from "@/lib/types";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function EpisodeSheet({
  open,
  onClose,
  title,
  episodes,
  currentId,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  episodes: Video[];
  currentId: string;
  onSelect: (videoId: string) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Episodes"
      className="max-h-[78dvh] overflow-hidden sm:max-h-[70vh]"
    >
      <p className="mb-3 line-clamp-1 text-sm text-white/50">{title}</p>
      <ul
        className="max-h-[min(52dvh,420px)] space-y-1 overflow-y-auto overscroll-contain pr-1"
        data-no-swipe
        data-sheet-scroll
        onWheel={(e) => e.stopPropagation()}
      >
        {episodes.map((ep) => {
          const active = ep.id === currentId;
          return (
            <li key={ep.id}>
              <button
                type="button"
                data-no-swipe
                onClick={() => {
                  onSelect(ep.id);
                  onClose();
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition",
                  active
                    ? "bg-[var(--slop-violet)]/20 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                    active
                      ? "bg-[var(--slop-violet)] text-[var(--slop-black)]"
                      : "bg-white/5",
                  )}
                >
                  {active ? (
                    <Play className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    String(ep.episodeNumber).padStart(2, "0")
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {ep.title || `Episode ${ep.episodeNumber}`}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-white/40">
                    Ep {ep.episodeNumber}
                    {ep.durationSeconds
                      ? ` · ${Math.round(ep.durationSeconds)}s`
                      : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {episodes.length === 0 && (
          <li className="px-2 py-8 text-center text-sm text-white/45">
            No episodes published yet.
          </li>
        )}
      </ul>
    </Dialog>
  );
}

export const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

export function formatSpeed(rate: number) {
  return Number.isInteger(rate) ? `${rate}.0x` : `${rate}x`;
}

export function nextPlaybackSpeed(current: number) {
  const idx = PLAYBACK_SPEEDS.findIndex((s) => Math.abs(s - current) < 0.01);
  const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
  return next;
}

export function loadPlaybackSpeed() {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem("slop-playback-rate");
  const n = raw ? Number(raw) : 1;
  return PLAYBACK_SPEEDS.includes(n as (typeof PLAYBACK_SPEEDS)[number])
    ? n
    : 1;
}

export function savePlaybackSpeed(rate: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("slop-playback-rate", String(rate));
}
