"use client";

import type { DateRangeKey } from "@/lib/analytics/types";

const OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last_7", label: "Last 7 days" },
  { key: "last_30", label: "Last 30 days" },
  { key: "last_90", label: "Last 90 days" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_year", label: "This year" },
  { key: "custom", label: "Custom" },
];

export function DateRangeFilter({
  value,
  onChange,
  from,
  to,
  onFrom,
  onTo,
}: {
  value: DateRangeKey;
  onChange: (v: DateRangeKey) => void;
  from?: string;
  to?: string;
  onFrom?: (v: string) => void;
  onTo?: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            value === o.key
              ? "bg-[var(--slop-violet)] text-[var(--slop-black)]"
              : "bg-white/10 text-white/70 hover:bg-white/15"
          }`}
        >
          {o.label}
        </button>
      ))}
      {value === "custom" && (
        <div className="flex gap-2">
          <input
            type="date"
            value={from ?? ""}
            onChange={(e) => onFrom?.(e.target.value)}
            className="h-9 rounded-lg border border-white/15 bg-white/5 px-2 text-xs"
          />
          <input
            type="date"
            value={to ?? ""}
            onChange={(e) => onTo?.(e.target.value)}
            className="h-9 rounded-lg border border-white/15 bg-white/5 px-2 text-xs"
          />
        </div>
      )}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--slop-slate)]">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {hint ? (
        <p className="mt-1 text-[11px] text-white/35">{hint}</p>
      ) : null}
    </div>
  );
}

export function SimpleBars({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="grid grid-cols-[88px_1fr_40px] items-center gap-2 text-xs">
          <span className="truncate text-white/60">{d.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--slop-violet)]"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className="text-right text-white/70">{d.value}</span>
        </div>
      ))}
      {data.length === 0 && (
        <p className="text-sm text-[var(--slop-slate)]">
          No recorded data in this range yet.
        </p>
      )}
    </div>
  );
}
