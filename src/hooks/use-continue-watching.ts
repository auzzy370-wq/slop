"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearContinueWatching,
  readContinueWatching,
  removeContinueWatching,
  subscribeContinueWatching,
  type ContinueWatchEntry,
} from "@/lib/continue-watching";

export function useContinueWatching() {
  const [entries, setEntries] = useState<ContinueWatchEntry[]>([]);

  const refresh = useCallback(() => {
    setEntries(readContinueWatching());
  }, []);

  useEffect(() => {
    refresh();
    return subscribeContinueWatching(refresh);
  }, [refresh]);

  return {
    entries,
    refresh,
    remove: (dramaId: string) => {
      removeContinueWatching(dramaId);
      refresh();
    },
    clear: () => {
      clearContinueWatching();
      refresh();
    },
  };
}
