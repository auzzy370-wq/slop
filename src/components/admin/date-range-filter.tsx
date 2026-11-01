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
  { key: "all_time", label: "All time" },
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
    <div className="min-w-0 space-y-2">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none sm:flex-wrap sm:overflow-visible">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              value === o.key
                ? "bg-[var(--slop-violet)] text-[var(--slop-black)]"
                : "bg-white/10 text-white/70 hover:bg-white/15"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {value === "custom" && (
        <div className="flex min-w-0 flex-wrap gap-2">
          <input
            type="date"
            value={from ?? ""}
            onChange={(e) => onFrom?.(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-2 text-xs sm:flex-none"
          />
          <input
            type="date"
            value={to ?? ""}
            onChange={(e) => onTo?.(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-2 text-xs sm:flex-none"
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
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
      <p className="text-[10px] uppercase leading-tight tracking-wide text-[var(--slop-slate)] sm:text-xs">
        {label}
      </p>
      <p className="mt-1.5 break-words font-display text-xl font-bold tabular-nums sm:mt-2 sm:text-2xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-white/35">{hint}</p>
      ) : null}
    </div>
  );
}

export function SimpleBars({
  data,
  formatValue,
  labelWidth = 88,
  maxRows,
}: {
  data: { label: string; value: number; color?: string }[];
  formatValue?: (value: number) => string;
  labelWidth?: number;
  /** Cap rows and enable internal scroll for long mobile lists. */
  maxRows?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const valueCol = formatValue ? 56 : 36;
  const mobileLabel = Math.min(labelWidth, 72);
  const rows = maxRows && data.length > maxRows ? data.slice(-maxRows) : data;
  return (
    <div className="min-w-0 space-y-2">
      <div
        className={`min-w-0 space-y-2 ${
          maxRows && data.length > maxRows
            ? "max-h-64 overflow-y-auto pr-1"
            : ""
        }`}
      >
        {rows.map((d) => (
          <div
            key={d.label}
            className="grid min-w-0 items-center gap-2 text-xs"
            style={{
              gridTemplateColumns: `minmax(0, ${mobileLabel}px) minmax(0, 1fr) ${valueCol}px`,
            }}
          >
            <span className="truncate text-white/60">{d.label}</span>
            <div className="h-2 min-w-0 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full max-w-full rounded-full"
                style={{
                  width: `${(d.value / max) * 100}%`,
                  backgroundColor: d.color || "var(--slop-violet)",
                }}
              />
            </div>
            <span className="truncate text-right tabular-nums text-white/70">
              {formatValue ? formatValue(d.value) : d.value}
            </span>
          </div>
        ))}
      </div>
      {data.length === 0 && (
        <p className="text-sm text-[var(--slop-slate)]">
          No recorded data in this range yet.
        </p>
      )}
      {maxRows && data.length > maxRows ? (
        <p className="text-[11px] text-white/35">
          Showing last {maxRows} of {data.length}
        </p>
      ) : null}
    </div>
  );
}

/** Horizontal stacked bar for share-of-total breakdowns (e.g. storage). */
export function StackedShareBar({
  segments,
  formatValue,
}: {
  segments: { label: string; value: number; color: string }[];
  formatValue?: (value: number) => string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total <= 0) {
    return (
      <p className="text-sm text-[var(--slop-slate)]">No storage data yet.</p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
        {segments.map((seg) =>
          seg.value <= 0 ? null : (
            <div
              key={seg.label}
              title={`${seg.label}: ${formatValue ? formatValue(seg.value) : seg.value}`}
              style={{
                width: `${(seg.value / total) * 100}%`,
                backgroundColor: seg.color,
              }}
            />
          ),
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
        {segments.map((seg) => (
          <span key={seg.label} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            {seg.label}{" "}
            <span className="tabular-nums text-white/80">
              {formatValue ? formatValue(seg.value) : seg.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Compact vertical column chart for daily / categorical trends. */
export function ColumnChart({
  data,
  height = 120,
  formatValue,
  emptyLabel = "No recorded data in this range yet.",
  maxBars = 14,
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  formatValue?: (value: number) => string;
  emptyLabel?: string;
  /** Keep mobile readable; older points stay available via horizontal scroll when fewer. */
  maxBars?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="text-sm text-[var(--slop-slate)]">{emptyLabel}</p>;
  }
  const bars =
    maxBars && data.length > maxBars ? data.slice(-maxBars) : data;
  const colW = 28;
  return (
    <div className="min-w-0 space-y-2">
      <div className="w-full min-w-0 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        <div
          className="flex items-end gap-1"
          style={{
            height,
            width: Math.max(bars.length * colW, 100),
            minWidth: "100%",
          }}
        >
          {bars.map((d) => {
            const h = Math.max(
              d.value > 0 ? 4 : 2,
              Math.round((d.value / max) * (height - 28)),
            );
            return (
              <div
                key={d.label}
                className="flex shrink-0 flex-col items-center justify-end gap-1"
                style={{ width: colW }}
                title={`${d.label}: ${formatValue ? formatValue(d.value) : d.value}`}
              >
                <span className="max-w-full truncate text-[9px] tabular-nums text-white/45">
                  {formatValue ? formatValue(d.value) : d.value}
                </span>
                <div
                  className="w-4 rounded-t-md sm:w-5"
                  style={{
                    height: h,
                    backgroundColor: d.color || "var(--slop-violet)",
                    opacity: d.value > 0 ? 1 : 0.25,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div
          className="mt-1 flex gap-1"
          style={{
            width: Math.max(bars.length * colW, 100),
            minWidth: "100%",
          }}
        >
          {bars.map((d) => (
            <span
              key={`l-${d.label}`}
              className="shrink-0 truncate text-center text-[9px] text-white/40"
              style={{ width: colW }}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
      {maxBars && data.length > maxBars ? (
        <p className="text-[11px] text-white/35">
          Showing last {maxBars} of {data.length} days
        </p>
      ) : null}
    </div>
  );
}

/** Grouped dual bars for comparing two series (e.g. sessions vs plays). */
export function GroupedBars({
  data,
  aLabel,
  bLabel,
  aColor = "var(--slop-violet)",
  bColor = "rgba(185, 154, 255, 0.45)",
  maxRows = 14,
}: {
  data: { label: string; a: number; b: number }[];
  aLabel: string;
  bLabel: string;
  aColor?: string;
  bColor?: string;
  maxRows?: number;
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  if (data.length === 0) {
    return (
      <p className="text-sm text-[var(--slop-slate)]">
        No recorded data in this range yet.
      </p>
    );
  }
  const rows =
    maxRows && data.length > maxRows ? data.slice(-maxRows) : data;
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-white/55">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: aColor }}
          />
          {aLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: bColor }}
          />
          {bLabel}
        </span>
      </div>
      <div
        className={`min-w-0 space-y-2 ${
          maxRows && data.length > maxRows
            ? "max-h-72 overflow-y-auto pr-1"
            : ""
        }`}
      >
        {rows.map((d) => (
          <div
            key={d.label}
            className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)] items-center gap-2 text-xs sm:grid-cols-[64px_minmax(0,1fr)]"
          >
            <span className="truncate text-white/55">{d.label}</span>
            <div className="min-w-0 space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full max-w-full rounded-full"
                  style={{
                    width: `${(d.a / max) * 100}%`,
                    backgroundColor: aColor,
                  }}
                />
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full max-w-full rounded-full"
                  style={{
                    width: `${(d.b / max) * 100}%`,
                    backgroundColor: bColor,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      {maxRows && data.length > maxRows ? (
        <p className="text-[11px] text-white/35">
          Showing last {maxRows} of {data.length} days
        </p>
      ) : null}
    </div>
  );
}
