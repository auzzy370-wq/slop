import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  isR2Configured,
  r2GetObjectText,
  r2PutObject,
} from "@/lib/r2";
import type { WatchPartyState } from "@/lib/watch-party";

const R2_KEY = "slop/social/watch-parties.json";

type PartyStore = {
  version: 1;
  parties: Record<string, WatchPartyState>;
  updatedAt: string;
};

let memory: PartyStore | null = null;

function empty(): PartyStore {
  return { version: 1, parties: {}, updatedAt: new Date().toISOString() };
}

function localPath() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "slop-data", "watch-parties.json");
  }
  return path.join(process.cwd(), "data", "watch-parties.json");
}

async function readStore(): Promise<PartyStore> {
  if (memory) return memory;
  if (isR2Configured()) {
    try {
      const raw = await r2GetObjectText(R2_KEY);
      if (raw) {
        memory = JSON.parse(raw) as PartyStore;
        return memory;
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const raw = await readFile(localPath(), "utf8");
    memory = JSON.parse(raw) as PartyStore;
    return memory;
  } catch {
    memory = empty();
    return memory;
  }
}

async function writeStore(store: PartyStore) {
  memory = store;
  store.updatedAt = new Date().toISOString();
  try {
    if (isR2Configured()) {
      await r2PutObject({
        key: R2_KEY,
        body: JSON.stringify(store),
        contentType: "application/json",
        cacheControl: "no-cache",
      });
    }
  } catch {
    /* optional */
  }
  try {
    const file = localPath();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(store), "utf8");
  } catch {
    /* ignore */
  }
}

function prune(store: PartyStore) {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const [id, party] of Object.entries(store.parties)) {
    if (Date.parse(party.updatedAt) < cutoff) delete store.parties[id];
  }
}

export async function getParty(roomId: string): Promise<WatchPartyState | null> {
  const store = await readStore();
  return store.parties[roomId] ?? null;
}

export async function saveParty(party: WatchPartyState): Promise<WatchPartyState> {
  const store = await readStore();
  prune(store);
  store.parties[party.roomId] = party;
  await writeStore(store);
  return party;
}
