"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EpisodeScript, ScriptBeat } from "@/lib/series/forgotten-wife/types";
import { scriptDurationSec } from "@/lib/series/forgotten-wife/types";
import { cn } from "@/lib/utils";

const MOOD_BG: Record<EpisodeScript["mood"], string> = {
  betrayal:
    "radial-gradient(ellipse at 30% 20%, rgba(120,40,60,0.55), transparent 55%), linear-gradient(160deg, #1a0f14 0%, #0a0a0c 45%, #140c18 100%)",
  return:
    "radial-gradient(ellipse at 70% 10%, rgba(70,70,120,0.45), transparent 50%), linear-gradient(160deg, #10141c 0%, #0a0a0c 50%, #121018 100%)",
  power:
    "radial-gradient(ellipse at 50% 0%, rgba(185,154,255,0.28), transparent 50%), linear-gradient(165deg, #141018 0%, #0a0a0c 55%, #101018 100%)",
  secret:
    "radial-gradient(ellipse at 20% 80%, rgba(40,80,90,0.4), transparent 55%), linear-gradient(160deg, #0c1214 0%, #0a0a0c 50%, #101010 100%)",
  fall:
    "radial-gradient(ellipse at 60% 30%, rgba(90,30,30,0.4), transparent 50%), linear-gradient(160deg, #140a0a 0%, #0a0a0c 55%, #100c0c 100%)",
  truth:
    "radial-gradient(ellipse at 40% 20%, rgba(80,100,140,0.35), transparent 50%), linear-gradient(160deg, #0e1218 0%, #0a0a0c 50%, #101418 100%)",
  revenge:
    "radial-gradient(ellipse at 80% 20%, rgba(140,60,40,0.4), transparent 50%), linear-gradient(160deg, #160e0c 0%, #0a0a0c 50%, #141010 100%)",
  final:
    "radial-gradient(ellipse at 50% 10%, rgba(185,154,255,0.35), transparent 45%), linear-gradient(165deg, #120e18 0%, #0a0a0c 55%, #0e1018 100%)",
};

function cumulativeStarts(beats: ScriptBeat[]): number[] {
  const starts: number[] = [];
  let t = 0;
  for (const b of beats) {
    starts.push(t);
    t += b.durationMs;
  }
  return starts;
}

export function ScriptedPlayer({
  script,
  active,
  paused,
  progress,
  onProgress,
  onDuration,
  onEnded,
  onTap,
}: {
  script: EpisodeScript;
  active: boolean;
  paused: boolean;
  progress: number;
  onProgress: (ratio: number, currentSec: number) => void;
  onDuration: (sec: number) => void;
  onEnded?: () => void;
  onTap: () => void;
}) {
  const durationSec = useMemo(() => scriptDurationSec(script), [script]);
  const starts = useMemo(
    () => cumulativeStarts(script.beats),
    [script.beats],
  );
  const totalMs = durationSec * 1000;
  const [beatIndex, setBeatIndex] = useState(0);
  const raf = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const elapsedMs = useRef(0);
  const endedRef = useRef(false);

  useEffect(() => {
    onDuration(durationSec);
  }, [durationSec, onDuration]);

  useEffect(() => {
    endedRef.current = false;
    elapsedMs.current = progress * totalMs;
    startedAt.current = null;
    // sync beat from progress
    const ms = elapsedMs.current;
    let idx = 0;
    for (let i = 0; i < starts.length; i++) {
      if (starts[i]! <= ms) idx = i;
    }
    setBeatIndex(idx);
  }, [script.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active || paused) {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
      if (startedAt.current != null) {
        elapsedMs.current += performance.now() - startedAt.current;
        startedAt.current = null;
      }
      return;
    }

    startedAt.current = performance.now();
    const tick = () => {
      const now = performance.now();
      const current =
        elapsedMs.current +
        (startedAt.current != null ? now - startedAt.current : 0);
      const clamped = Math.min(current, totalMs);
      const ratio = clamped / totalMs;
      onProgress(ratio, clamped / 1000);

      let idx = 0;
      for (let i = 0; i < starts.length; i++) {
        if (starts[i]! <= clamped) idx = i;
      }
      setBeatIndex(idx);

      if (clamped >= totalMs) {
        if (!endedRef.current) {
          endedRef.current = true;
          onEnded?.();
        }
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (startedAt.current != null) {
        elapsedMs.current += performance.now() - startedAt.current;
        startedAt.current = null;
      }
    };
  }, [active, paused, totalMs, starts, onProgress, onEnded]);

  // External scrub: when progress jumps while paused/active
  useEffect(() => {
    if (!paused && active) return;
    const ms = progress * totalMs;
    elapsedMs.current = ms;
    let idx = 0;
    for (let i = 0; i < starts.length; i++) {
      if (starts[i]! <= ms) idx = i;
    }
    setBeatIndex(idx);
  }, [progress, paused, active, totalMs, starts]);

  const beat = script.beats[beatIndex] ?? script.beats[0];

  return (
    <button
      type="button"
      className="absolute inset-0 h-full w-full cursor-pointer border-0 text-left"
      style={{ background: MOOD_BG[script.mood] }}
      onClick={onTap}
      aria-label="Scripted episode surface"
    >
      <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-soft-light">
        <div className="absolute -left-20 top-24 h-64 w-64 rounded-full bg-[var(--slop-violet)]/20 blur-3xl" />
        <div className="absolute -right-16 bottom-40 h-72 w-72 rounded-full bg-rose-700/15 blur-3xl" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-[28%] px-6 text-center sm:px-10">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--slop-lavender)]/80">
          SLOP Original
        </p>
        <p className="mt-2 font-display text-2xl font-bold tracking-tight text-white/90 sm:text-3xl">
          The Billionaire&apos;s Forgotten Wife
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/35">
          Ep {String(script.episodeNumber).padStart(2, "0")} · {script.title}
        </p>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-[9.5rem] z-10 px-4 sm:bottom-[10rem] sm:px-6">
        <SubtitleCard beat={beat} key={`${script.id}-${beatIndex}`} />
      </div>
    </button>
  );
}

function SubtitleCard({ beat }: { beat: ScriptBeat | undefined }) {
  if (!beat) return null;

  if (beat.type === "setting") {
    return (
      <div className="mx-auto max-w-lg animate-fade text-center">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.22em] text-white/70 sm:text-base">
          {beat.text}
        </p>
      </div>
    );
  }

  if (beat.type === "caption") {
    return (
      <div className="mx-auto max-w-lg animate-fade rounded-xl border border-white/10 bg-black/55 px-4 py-3 text-center backdrop-blur-md">
        <p className="font-display text-base font-semibold leading-snug text-[var(--slop-lavender)] sm:text-lg">
          {beat.text}
        </p>
      </div>
    );
  }

  if (beat.type === "action") {
    return (
      <div className="mx-auto max-w-lg animate-fade text-center">
        <p className="text-sm italic leading-relaxed text-white/75 sm:text-base">
          {beat.text}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto max-w-lg animate-fade rounded-xl border border-white/12 bg-black/60 px-4 py-3.5 backdrop-blur-md",
      )}
    >
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--slop-violet)]">
        {beat.speaker}
      </p>
      <p className="font-display text-lg font-semibold leading-snug text-white sm:text-xl">
        {beat.text}
      </p>
    </div>
  );
}

/** Seek helper for parent scrubbing */
export function seekScriptedElapsed(
  progressRatio: number,
  durationSec: number,
): number {
  return progressRatio * durationSec * 1000;
}
