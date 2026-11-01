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

function isServerless() {
  return Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );
}

/** Local/dev path, or /tmp on Vercel (repo `data/` is read-only there). */
function localPath() {
  if (isServerless()) {
    return path.join("/tmp", "slop-data", "site-settings.json");
  }
  return path.join(process.cwd(), "data", "site-settings.json");
}

async function readLocal(): Promise<SiteSettings | null> {
  try {
    const raw = await readFile(localPath(), "utf8");
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeLocal(settings: SiteSettings): Promise<boolean> {
  try {
    const file = localPath();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(settings, null, 2), "utf8");
    return true;
  } catch (err) {
    // Never fail the request on ephemeral/local disk — cloud is source of truth.
    console.warn(
      "site-settings local write skipped",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
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
      hit.url.includes("?")
        ? `${hit.url}&t=${Date.now()}`
        : `${hit.url}?t=${Date.now()}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return normalize(await res.json());
  } catch {
    return null;
  }
}

async function writeBlob(settings: SiteSettings): Promise<boolean> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  try {
    const { put } = await import("@vercel/blob");
    await put(SITE_SETTINGS_PATH, JSON.stringify(settings), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
    return true;
  } catch (err) {
    console.error("site-settings blob write failed", err);
    return false;
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

async function writeR2(settings: SiteSettings): Promise<boolean> {
  if (!isR2Configured()) return false;
  try {
    await r2PutObject({
      key: SITE_SETTINGS_PATH,
      body: JSON.stringify(settings),
      contentType: "application/json",
      cacheControl: "no-cache",
    });
    return true;
  } catch (err) {
    console.error("site-settings r2 write failed", err);
    return false;
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

  const [r2Ok, blobOk] = await Promise.all([
    writeR2(next),
    writeBlob(next),
  ]);
  // Best-effort local cache (never required on Vercel).
  await writeLocal(next);

  if (!r2Ok && !blobOk) {
    if (isServerless()) {
      throw new Error(
        "Could not save site settings to cloud storage. Ensure Cloudflare R2 (R2_*) is configured — the Vercel filesystem is read-only.",
      );
    }
    // Local-only dev without cloud is fine if /data wrote.
    const local = await readLocal();
    if (!local || local.updatedAt !== next.updatedAt) {
      throw new Error(
        "Could not save site settings. Configure R2_* or ensure data/ is writable.",
      );
    }
  }

  return next;
}
