/** Device-local viewer preferences (works for guests + signed-in). */

const REACTIONS_KEY = "slop-reactions-enabled";
const REMINDER_KEY = "slop-daily-drop-reminder";
const CHANGE = "slop:viewer-prefs";

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE));
}

export function readReactionsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(REACTIONS_KEY);
    if (raw == null) return true;
    return raw !== "0" && raw !== "false";
  } catch {
    return true;
  }
}

export function setReactionsEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REACTIONS_KEY, on ? "1" : "0");
    emit();
  } catch {
    /* ignore */
  }
}

export function readDailyDropReminder(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(REMINDER_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDailyDropReminder(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REMINDER_KEY, on ? "1" : "0");
    emit();
  } catch {
    /* ignore */
  }
}

export function subscribeViewerPrefs(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE, cb);
    window.removeEventListener("storage", cb);
  };
}
