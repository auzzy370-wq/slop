import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  isR2Configured,
  r2GetObjectText,
  r2PutObject,
} from "@/lib/r2";

export const SITE_SETTINGS_PATH = "slop/catalog/site-settings.json";

export type SiteSettings = {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  updatedAt: string;
};

const DEFAULT_MESSAGE =
  "SLOP is temporarily down for maintenance. We’ll be back shortly.";

export function defaultSiteSettings(): SiteSettings {
  return {
    maintenanceMode: false,
    maintenanceMessage: DEFAULT_MESSAGE,
    updatedAt: new Date().toISOString(),
  };
}

const LOCAL_PATH = path.join(process.cwd(), "data", "site-settings.json");

async function readLocal(): Promise<SiteSettings | null> {
  try {
    const raw = await readFile(LOCAL_PATH, "utf8");
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeLocal(settings: SiteSettings) {
  await mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await writeFile(LOCAL_PATH, JSON.stringify(settings, null, 2), "utf8");
}

async function readBlob(): Promise<SiteSettings | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: SITE_SETTINGS_PATH, limit: 5 });
    const hit =
      blobs.find((b) => b.pathname === SITE_SETTINGS_PATH) ?? blobs[0];
    if (!hit?.url) return null;
    const res = await fetch(
      hit.url.includes("?") ? `${hit.url}&t=${Date.now()}` : `${hit.url}?t=${Date.now()}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return normalize(await res.json());
  } catch {
    return null;
  }
}

async function writeBlob(settings: SiteSettings) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const { put } = await import("@vercel/blob");
    await put(SITE_SETTINGS_PATH, JSON.stringify(settings), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
  } catch (err) {
    console.error("site-settings blob write failed", err);
  }
}

async function readR2(): Promise<SiteSettings | null> {
  if (!isR2Configured()) return null;
  try {
    const raw = await r2GetObjectText(SITE_SETTINGS_PATH);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeR2(settings: SiteSettings) {
  if (!isR2Configured()) return;
  try {
    await r2PutObject({
      key: SITE_SETTINGS_PATH,
      body: JSON.stringify(settings),
      contentType: "application/json",
      cacheControl: "no-cache",
    });
  } catch (err) {
    console.error("site-settings r2 write failed", err);
  }
}

function normalize(raw: unknown): SiteSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<SiteSettings>;
  return {
    maintenanceMode: Boolean(o.maintenanceMode),
    maintenanceMessage:
      typeof o.maintenanceMessage === "string" && o.maintenanceMessage.trim()
        ? o.maintenanceMessage.trim()
        : DEFAULT_MESSAGE,
    updatedAt:
      typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  };
}

function pickNewer(a: SiteSettings | null, b: SiteSettings | null) {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.updatedAt) >= Date.parse(a.updatedAt) ? b : a;
}

export async function loadSiteSettings(): Promise<SiteSettings> {
  const [r2, blob, local] = await Promise.all([
    readR2(),
    readBlob(),
    readLocal(),
  ]);
  return pickNewer(pickNewer(r2, blob), local) ?? defaultSiteSettings();
}

export async function saveSiteSettings(
  patch: Partial<Pick<SiteSettings, "maintenanceMode" | "maintenanceMessage">>,
): Promise<SiteSettings> {
  const current = await loadSiteSettings();
  const next: SiteSettings = {
    maintenanceMode:
      typeof patch.maintenanceMode === "boolean"
        ? patch.maintenanceMode
        : current.maintenanceMode,
    maintenanceMessage:
      typeof patch.maintenanceMessage === "string" &&
      patch.maintenanceMessage.trim()
        ? patch.maintenanceMessage.trim()
        : current.maintenanceMessage,
    updatedAt: new Date().toISOString(),
  };
  await Promise.all([writeR2(next), writeBlob(next), writeLocal(next)]);
  return next;
}
