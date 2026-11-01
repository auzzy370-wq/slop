import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Comment, Like } from "@/lib/types";

export const SOCIAL_BLOB_PATH = "slop/social/engagement.json";

export type SocialEngagementStore = {
  version: 1;
  likes: Like[];
  comments: Comment[];
  updatedAt: string;
};

const LOCAL_PATH = path.join(process.cwd(), "data", "social-engagement.json");

let memory: SocialEngagementStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

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

async function readLocal(): Promise<SocialEngagementStore | null> {
  try {
    const raw = await readFile(LOCAL_PATH, "utf8");
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeLocal(store: SocialEngagementStore): Promise<void> {
  await mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await writeFile(LOCAL_PATH, JSON.stringify(store), "utf8");
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
  const { put } = await import("@vercel/blob");
  await put(SOCIAL_BLOB_PATH, JSON.stringify(store), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

async function loadFresh(): Promise<SocialEngagementStore> {
  const fromBlob = await readBlob();
  if (fromBlob) return fromBlob;
  const fromLocal = await readLocal();
  if (fromLocal) return fromLocal;
  return emptySocialStore();
}

export async function readSocialStore(): Promise<SocialEngagementStore> {
  if (memory) return memory;
  memory = await loadFresh();
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
    try {
      await writeBlob(fresh);
    } catch (err) {
      console.error("social blob write failed", err);
    }
    try {
      await writeLocal(fresh);
    } catch {
      /* local FS may be read-only on serverless */
    }
  });
  await writeQueue;
  return memory!;
}
