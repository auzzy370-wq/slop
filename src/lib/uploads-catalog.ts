import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  emptyUploadsCatalog,
  UPLOADS_BLOB_PATH,
  type UploadsCatalog,
} from "@/lib/uploads-catalog-shared";

export {
  emptyUploadsCatalog,
  mergeSeedWithUploads,
  upsertUploadsCatalog,
  UPLOADS_BLOB_PATH,
  type UploadsCatalog,
} from "@/lib/uploads-catalog-shared";

const LOCAL_PATH = path.join(process.cwd(), "data", "uploads-catalog.json");

async function readLocalCatalog(): Promise<UploadsCatalog | null> {
  try {
    const raw = await readFile(LOCAL_PATH, "utf8");
    const parsed = JSON.parse(raw) as UploadsCatalog;
    if (!parsed || !Array.isArray(parsed.videos) || !Array.isArray(parsed.dramas)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeLocalCatalog(catalog: UploadsCatalog): Promise<void> {
  await mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await writeFile(LOCAL_PATH, JSON.stringify(catalog, null, 2), "utf8");
}

async function readBlobCatalog(): Promise<UploadsCatalog | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({
      prefix: UPLOADS_BLOB_PATH,
      limit: 10,
    });
    const hit =
      blobs.find((b) => b.pathname === UPLOADS_BLOB_PATH) ?? blobs[0];
    if (!hit?.url) return null;
    const res = await fetch(hit.url, { cache: "no-store" });
    if (!res.ok) return null;
    const parsed = (await res.json()) as UploadsCatalog;
    if (!parsed || !Array.isArray(parsed.videos) || !Array.isArray(parsed.dramas)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeBlobCatalog(catalog: UploadsCatalog): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const { put } = await import("@vercel/blob");
  const blob = await put(UPLOADS_BLOB_PATH, JSON.stringify(catalog), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  return blob.url;
}

export async function loadUploadsCatalog(): Promise<UploadsCatalog> {
  const fromBlob = await readBlobCatalog();
  if (fromBlob) return fromBlob;
  const fromLocal = await readLocalCatalog();
  if (fromLocal) return fromLocal;
  return emptyUploadsCatalog();
}

export async function saveUploadsCatalog(
  catalog: UploadsCatalog,
): Promise<{ ok: true; url?: string | null }> {
  let url: string | null = null;
  try {
    url = await writeBlobCatalog(catalog);
  } catch (err) {
    console.error("blob catalog write failed", err);
  }
  try {
    await writeLocalCatalog(catalog);
  } catch (err) {
    if (!url) throw err;
  }
  return { ok: true, url };
}
