import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  isR2Configured,
  r2GetObjectText,
  r2PutObject,
} from "@/lib/r2";

const CATALOG_KEY = "slop/catalog/uploads.json";

type Catalog = {
  videos?: Array<{
    id: string;
    status?: string;
    scheduledAt?: string | null;
    publishedAt?: string | null;
    [k: string]: unknown;
  }>;
  dramas?: Array<{
    id: string;
    status?: string;
    publishedAt?: string | null;
    [k: string]: unknown;
  }>;
  updatedAt?: string;
};

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function readCatalog(): Promise<Catalog> {
  if (isR2Configured()) {
    const raw = await r2GetObjectText(CATALOG_KEY);
    if (raw) return JSON.parse(raw) as Catalog;
  }
  try {
    const file = path.join(process.cwd(), "data", "uploads-catalog.json");
    return JSON.parse(await readFile(file, "utf8")) as Catalog;
  } catch {
    return { videos: [], dramas: [] };
  }
}

async function writeCatalog(catalog: Catalog) {
  catalog.updatedAt = new Date().toISOString();
  const body = JSON.stringify(catalog);
  if (isR2Configured()) {
    await r2PutObject({
      key: CATALOG_KEY,
      body,
      contentType: "application/json",
      cacheControl: "no-cache",
    });
  }
  try {
    const file = path.join(process.cwd(), "data", "uploads-catalog.json");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body, "utf8");
  } catch {
    /* ignore */
  }
}

/** Promote due `scheduled` episodes to `published`. */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const catalog = await readCatalog();
  const now = Date.now();
  let published = 0;
  const dramaIds = new Set<string>();

  catalog.videos = (catalog.videos ?? []).map((v) => {
    if (v.status !== "scheduled") return v;
    const due = v.scheduledAt ? Date.parse(v.scheduledAt) : NaN;
    if (!Number.isFinite(due) || due > now) return v;
    published += 1;
    if (typeof v.dramaId === "string") dramaIds.add(v.dramaId);
    return {
      ...v,
      status: "published",
      publishedAt: v.publishedAt ?? new Date().toISOString(),
    };
  });

  if (dramaIds.size > 0) {
    catalog.dramas = (catalog.dramas ?? []).map((d) => {
      if (!dramaIds.has(d.id)) return d;
      if (d.status === "published") return d;
      return {
        ...d,
        status: "published",
        publishedAt: d.publishedAt ?? new Date().toISOString(),
      };
    });
  }

  if (published > 0) await writeCatalog(catalog);

  return NextResponse.json({
    ok: true,
    published,
    checkedAt: new Date().toISOString(),
  });
}
