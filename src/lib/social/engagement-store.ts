import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Comment, Like } from "@/lib/types";
import {
  isR2Configured,
  r2GetObjectText,
  r2PutObject,
} from "@/lib/r2";

export const SOCIAL_BLOB_PATH = "slop/social/engagement.json";
/** Same key on R2 — Blob public reads are blocked on the suspended store. */
export const SOCIAL_R2_KEY = SOCIAL_BLOB_PATH;

export type SocialEngagementStore = {
  version: 1;
  likes: Like[];
  comments: Comment[];
  updatedAt: string;
};

function isServerless() {
  return Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );
}

function localPath() {
  if (isServerless()) {
    return path.join("/tmp", "slop-data", "social-engagement.json");
  }
  return path.join(process.cwd(), "data", "social-engagement.json");
}

let memory: SocialEngagementStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let memoryAt = 0;
/** Never serve in-process memory older than this — serverless instances drift. */
const MEMORY_TTL_MS = 2_000;

export function emptySocialStore(): SocialEngagementStore {
  return {
    version: 1,
    likes: [],
    comments: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalize(raw: unknown): SocialEngagementStore {
  const base = emptySocialStore();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<SocialEngagementStore>;
  return {
    version: 1,
    likes: Array.isArray(data.likes) ? data.likes : [],
    comments: Array.isArray(data.comments) ? data.comments : [],
    updatedAt:
      typeof data.updatedAt === "string"
        ? data.updatedAt
        : new Date().toISOString(),
  };
}

function pickNewer(
  a: SocialEngagementStore | null,
  b: SocialEngagementStore | null,
): SocialEngagementStore | null {
  if (!a) return b;
  if (!b) return a;
  const at = Date.parse(a.updatedAt || "");
  const bt = Date.parse(b.updatedAt || "");
  if (Number.isFinite(at) && Number.isFinite(bt)) {
    return bt >= at ? b : a;
  }
  const aScore = (a.likes?.length ?? 0) + (a.comments?.length ?? 0);
  const bScore = (b.likes?.length ?? 0) + (b.comments?.length ?? 0);
  return bScore >= aScore ? b : a;
}

async function readLocal(): Promise<SocialEngagementStore | null> {
  try {
    const raw = await readFile(localPath(), "utf8");
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeLocal(store: SocialEngagementStore): Promise<void> {
  try {
    const file = localPath();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(store), "utf8");
  } catch {
    /* local FS may be read-only on serverless */
  }
}

async function readR2(): Promise<SocialEngagementStore | null> {
  if (!isR2Configured()) return null;
  try {
    const raw = await r2GetObjectText(SOCIAL_R2_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeR2(store: SocialEngagementStore): Promise<void> {
  if (!isR2Configured()) return;
  await r2PutObject({
    key: SOCIAL_R2_KEY,
    body: JSON.stringify(store),
    contentType: "application/json",
    cacheControl: "no-cache",
  });
}

async function readBlob(): Promise<SocialEngagementStore | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({
      prefix: SOCIAL_BLOB_PATH,
      limit: 10,
    });
    const hit =
      blobs.find((b) => b.pathname === SOCIAL_BLOB_PATH) ?? blobs[0];
    if (!hit?.url) return null;
    const bust = `t=${Date.now()}`;
    const url = hit.url.includes("?")
      ? `${hit.url}&${bust}`
      : `${hit.url}?${bust}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    if (!res.ok) return null;
    return normalize(await res.json());
  } catch {
    return null;
  }
}

async function writeBlob(store: SocialEngagementStore): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const { put } = await import("@vercel/blob");
    await put(SOCIAL_BLOB_PATH, JSON.stringify(store), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
  } catch (err) {
    // Blob store is often suspended — R2 is the source of truth.
    console.warn(
      "social blob write skipped",
      err instanceof Error ? err.message : err,
    );
  }
}

async function loadFresh(): Promise<SocialEngagementStore> {
  const [fromR2, fromBlob, fromLocal] = await Promise.all([
    readR2(),
    readBlob(),
    readLocal(),
  ]);
  const best = pickNewer(pickNewer(fromR2, fromBlob), fromLocal);
  return best ?? emptySocialStore();
}

/** Always prefer cloud — warm serverless memory goes stale across instances. */
export async function readSocialStore(): Promise<SocialEngagementStore> {
  const now = Date.now();
  if (memory && now - memoryAt < MEMORY_TTL_MS) return memory;
  memory = await loadFresh();
  memoryAt = Date.now();
  return memory;
}

export async function updateSocialStore(
  mutator: (draft: SocialEngagementStore) => void | Promise<void>,
): Promise<SocialEngagementStore> {
  writeQueue = writeQueue.then(async () => {
    const fresh = await loadFresh();
    await mutator(fresh);
    fresh.updatedAt = new Date().toISOString();
    memory = fresh;
    memoryAt = Date.now();
    try {
      await writeR2(fresh);
    } catch (err) {
      console.error("social r2 write failed", err);
    }
    try {
      await writeBlob(fresh);
    } catch {
      /* optional */
    }
    await writeLocal(fresh);
  });
  await writeQueue;
  return memory!;
}
