"use client";

import { useEffect, useState } from "react";
import {
  MOOD_OPTIONS,
  readMoodFilters,
  setMoodFilters,
  subscribeViewerPrefs,
  type MoodId,
} from "@/lib/viewer-prefs";

export function MoodFilters({ className = "" }: { className?: string }) {
  const [active, setActive] = useState<MoodId[]>([]);

  useEffect(() => {
    const sync = () => setActive(readMoodFilters());
    sync();
    return subscribeViewerPrefs(sync);
  }, []);

  const toggle = (id: MoodId) => {
    const next = active.includes(id)
      ? active.filter((m) => m !== id)
      : [...active, id];
    setMoodFilters(next);
    setActive(next);
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
      data-no-swipe
    >
      <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
        Mood
      </span>
      {MOOD_OPTIONS.map((mood) => {
        const on = active.includes(mood.id);
        return (
          <button
            key={mood.id}
            type="button"
            onClick={() => toggle(mood.id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              on
                ? "bg-[var(--slop-violet)] text-[var(--slop-ink)]"
                : "border border-white/12 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
            aria-pressed={on}
          >
            {mood.label}
          </button>
        );
      })}
    </div>
  );
}

export function moodCategoryIdsFromPrefs(): string[] {
  const moods = readMoodFilters();
  if (moods.length === 0) return [];
  return MOOD_OPTIONS.filter((m) => moods.includes(m.id)).flatMap(
    (m) => m.categoryIds,
  );
}
