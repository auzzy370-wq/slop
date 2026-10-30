import { promises as fs } from "fs";
import path from "path";
import type { SocialStoreData } from "./types";

function resolveDataDir() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "slop-data");
  }
  return path.join(process.cwd(), "data");
}

const DATA_DIR = resolveDataDir();
const STORE_PATH = path.join(DATA_DIR, "social-posts.json");

let memory: SocialStoreData | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function ensureLoaded(): Promise<SocialStoreData> {
  if (memory) return memory;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    memory = JSON.parse(raw) as SocialStoreData;
    if (!Array.isArray(memory.posts)) memory.posts = [];
  } catch {
    memory = { posts: [] };
    await persist(memory);
  }
  return memory!;
}

async function persist(data: SocialStoreData) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${STORE_PATH}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.rename(tmp, STORE_PATH);
  } catch {
    // serverless may be memory-only
  }
}

export async function readSocialStore() {
  return ensureLoaded();
}

export async function updateSocialStore(
  mutator: (draft: SocialStoreData) => void | Promise<void>,
) {
  writeQueue = writeQueue.then(async () => {
    const data = await ensureLoaded();
    await mutator(data);
    memory = data;
    await persist(data);
  });
  await writeQueue;
  return memory!;
}

export async function alreadyPosted(
  episodeId: string,
  channel: string,
): Promise<boolean> {
  const store = await ensureLoaded();
  return store.posts.some(
    (p) =>
      p.episodeId === episodeId &&
      p.channel === channel &&
      p.status === "posted",
  );
}
