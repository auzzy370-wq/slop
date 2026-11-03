import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  isR2Configured,
  r2GetObjectText,
  r2PutObject,
} from "@/lib/r2";

const R2_KEY = "slop/social/live-reactions.json";
/** Keep reactions only while floats are still useful to show. */
const TTL_MS = 12_000;
const MAX_ITEMS = 240;
const MEMORY_TTL_MS = 800;

export type LiveReaction = {
  id: string;
  episodeId: string;
  emoji: string;
  x: number;
  y: number;
  at: number;
  actorId?: string | null;
};

type ReactionStore = {
  version: 1;
  reactions: LiveReaction[];
  updatedAt: string;
};

let memory: ReactionStore | null = null;
let memoryAt = 0;
let writeQueue: Promise<void> = Promise.resolve();

function empty(): ReactionStore {
  return {
    version: 1,
    reactions: [],
    updatedAt: new Date().toISOString(),
  };
}

function isServerless() {
  return Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );
}

function localPath() {
  if (isServerless()) {
    return path.join("/tmp", "slop-data", "live-reactions.json");
  }
  return path.join(process.cwd(), "data", "live-reactions.json");
}

function prune(store: ReactionStore, now = Date.now()) {
  const cutoff = now - TTL_MS;
  store.reactions = store.reactions
    .filter((r) => r.at >= cutoff)
    .slice(-MAX_ITEMS);
}

function normalize(raw: unknown): ReactionStore {
  const base = empty();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<ReactionStore>;
  const reactions = Array.isArray(data.reactions)
    ? data.reactions.filter(
        (r): r is LiveReaction =>
          !!r &&
          typeof r === "object" &&
          typeof (r as LiveReaction).id === "string" &&
          typeof (r as LiveReaction).episodeId === "string" &&
          typeof (r as LiveReaction).emoji === "string" &&
          typeof (r as LiveReaction).at === "number",
      )
    : [];
  const store: ReactionStore = {
    version: 1,
    reactions,
    updatedAt:
      typeof data.updatedAt === "string"
        ? data.updatedAt
        : new Date().toISOString(),
  };
  prune(store);
  return store;
}

async function readLocal(): Promise<ReactionStore | null> {
  try {
    const raw = await readFile(localPath(), "utf8");
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeLocal(store: ReactionStore) {
  try {
    const file = localPath();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(store), "utf8");
  } catch {
    /* ignore */
  }
}

async function readR2(): Promise<ReactionStore | null> {
  if (!isR2Configured()) return null;
  try {
    const raw = await r2GetObjectText(R2_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeR2(store: ReactionStore) {
  if (!isR2Configured()) return;
  await r2PutObject({
    key: R2_KEY,
    body: JSON.stringify(store),
    contentType: "application/json",
    cacheControl: "no-cache",
  });
}

function pickNewer(
  a: ReactionStore | null,
  b: ReactionStore | null,
): ReactionStore | null {
  if (!a) return b;
  if (!b) return a;
  const at = Date.parse(a.updatedAt || "");
  const bt = Date.parse(b.updatedAt || "");
  if (Number.isFinite(at) && Number.isFinite(bt)) {
    return bt >= at ? b : a;
  }
  return (b.reactions?.length ?? 0) >= (a.reactions?.length ?? 0) ? b : a;
}

async function loadFresh(): Promise<ReactionStore> {
  const [fromR2, fromLocal] = await Promise.all([readR2(), readLocal()]);
  return pickNewer(fromR2, fromLocal) ?? empty();
}

async function readStore(): Promise<ReactionStore> {
  const now = Date.now();
  if (memory && now - memoryAt < MEMORY_TTL_MS) {
    prune(memory, now);
    return memory;
  }
  memory = await loadFresh();
  memoryAt = Date.now();
  return memory;
}

export async function listLiveReactions(input: {
  episodeId: string;
  since?: number;
}): Promise<LiveReaction[]> {
  const store = await readStore();
  const since = input.since ?? Date.now() - TTL_MS;
  return store.reactions.filter(
    (r) => r.episodeId === input.episodeId && r.at > since,
  );
}

export async function publishLiveReaction(
  reaction: LiveReaction,
): Promise<LiveReaction> {
  writeQueue = writeQueue.then(async () => {
    const store = await loadFresh();
    prune(store);
    if (!store.reactions.some((r) => r.id === reaction.id)) {
      store.reactions.push(reaction);
    }
    prune(store);
    store.updatedAt = new Date().toISOString();
    memory = store;
    memoryAt = Date.now();
    try {
      await writeR2(store);
    } catch (err) {
      console.error("live reaction r2 write failed", err);
    }
    await writeLocal(store);
  });
  await writeQueue;
  return reaction;
}

export const LIVE_REACTION_TTL_MS = TTL_MS;
export const LIVE_REACTION_EMOJIS = ["🔥", "😂", "😭"] as const;
