import type { DateRangeKey } from "./types";

export function resolveDateRange(
  key: DateRangeKey,
  customFrom?: string | null,
  customTo?: string | null,
): { from: Date; to: Date; label: string } {
  const now = new Date();
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  switch (key) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now), label: "Today" };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y), label: "Yesterday" };
    }
    case "last_7": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { from, to: endOfDay(now), label: "Last 7 days" };
    }
    case "last_30": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      return { from, to: endOfDay(now), label: "Last 30 days" };
    }
    case "last_90": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 89);
      return { from, to: endOfDay(now), label: "Last 90 days" };
    }
    case "this_month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to: endOfDay(now), label: "This month" };
    }
    case "last_month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from, to, label: "Last month" };
    }
    case "this_year": {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from, to: endOfDay(now), label: "This year" };
    }
    case "all_time": {
      return {
        from: new Date(0),
        to: endOfDay(now),
        label: "All time",
      };
    }
    case "custom": {
      const from = customFrom ? new Date(customFrom) : startOfDay(now);
      const to = customTo ? endOfDay(new Date(customTo)) : endOfDay(now);
      return { from, to, label: "Custom range" };
    }
    default:
      return resolveDateRange("last_30");
  }
}

export function inRange(iso: string, from: Date, to: Date) {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}
