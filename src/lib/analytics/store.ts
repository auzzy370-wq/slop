import { promises as fs } from "fs";
import path from "path";
import { emptyAnalyticsStore } from "./defaults";
import type { AnalyticsStoreData } from "./types";

/**
 * On Vercel/serverless the filesystem is ephemeral; use /tmp.
 * Locally prefer ./data for persistence across restarts.
 */
function resolveDataDir() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "slop-data");
  }
  return path.join(process.cwd(), "data");
}

const DATA_DIR = resolveDataDir();
const STORE_PATH = path.join(DATA_DIR, "analytics-store.json");

let memory: AnalyticsStoreData | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function ensureLoaded(): Promise<AnalyticsStoreData> {
  if (memory) return memory;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    memory = JSON.parse(raw) as AnalyticsStoreData;
    const base = emptyAnalyticsStore();
    memory = {
      ...base,
      ...memory,
      rewardRules: memory.rewardRules?.length
        ? memory.rewardRules
        : base.rewardRules,
    };
  } catch {
    memory = emptyAnalyticsStore();
    await persist(memory);
  }
  return memory!;
}

async function persist(data: AnalyticsStoreData) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${STORE_PATH}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data), "utf8");
    await fs.rename(tmp, STORE_PATH);
  } catch {
    // Serverless cold starts / read-only FS: keep in-memory only
  }
}

export async function readAnalyticsStore(): Promise<AnalyticsStoreData> {
  return ensureLoaded();
}

export async function updateAnalyticsStore(
  mutator: (draft: AnalyticsStoreData) => void | Promise<void>,
): Promise<AnalyticsStoreData> {
  writeQueue = writeQueue.then(async () => {
    const data = await ensureLoaded();
    await mutator(data);
    memory = data;
    await persist(data);
  });
  await writeQueue;
  return memory!;
}

export function analyticsStorePath() {
  return STORE_PATH;
}
