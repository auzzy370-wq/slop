/** Local “Not interested” list — trains For You by hiding dramas. */

const STORAGE_KEY = "slop-hidden-dramas-v1";
const CHANGE = "slop:hidden-dramas";

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE));
}

export function readHiddenDramaIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function isDramaHidden(dramaId: string): boolean {
  return readHiddenDramaIds().includes(dramaId);
}

export function hideDrama(dramaId: string) {
  if (typeof window === "undefined" || !dramaId) return;
  const next = Array.from(new Set([...readHiddenDramaIds(), dramaId]));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emit();
  } catch {
    /* ignore */
  }
}

export function unhideDrama(dramaId: string) {
  if (typeof window === "undefined") return;
  const next = readHiddenDramaIds().filter((id) => id !== dramaId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emit();
  } catch {
    /* ignore */
  }
}

export function clearHiddenDramas() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    emit();
  } catch {
    /* ignore */
  }
}

export function subscribeHiddenDramas(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE, cb);
    window.removeEventListener("storage", cb);
  };
}
