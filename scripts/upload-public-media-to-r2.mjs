#!/usr/bin/env node
/**
 * Upload the seed library (videos, thumbnails, posters, banners) to Cloudflare R2.
 *
 * Objects are stored at the same path the app requests:
 *   {R2_PUBLIC_BASE_URL}/videos/<file>.mp4
 *   {R2_PUBLIC_BASE_URL}/thumbnails/<file>.jpg
 *   {R2_PUBLIC_BASE_URL}/posters/<file>.jpg
 *   {R2_PUBLIC_BASE_URL}/banners/<file>.jpg
 *
 * Credentials are read from the environment or from .env / .env.local.
 * Nothing is hardcoded. Required:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_BASE_URL
 *
 * Usage:
 *   node scripts/upload-public-media-to-r2.mjs
 *   node scripts/upload-public-media-to-r2.mjs --dry-run
 *   node scripts/upload-public-media-to-r2.mjs --root /tmp/slop-media/public
 *   node scripts/upload-public-media-to-r2.mjs --force
 *
 * The media directories are not in git. Restore them from main before uploading:
 *   mkdir -p /tmp/slop-media
 *   git archive origin/main public/videos public/thumbnails public/posters public/banners | tar -x -C /tmp/slop-media
 *   node scripts/upload-public-media-to-r2.mjs --root /tmp/slop-media/public
 */

import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIRS = ["videos", "thumbnails", "posters", "banners"];
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const CONTENT_TYPES = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const REQUIRED = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_BASE_URL",
];

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadLocalEnv() {
  const merged = {
    ...readEnvFile(path.join(ROOT, ".env")),
    ...readEnvFile(path.join(ROOT, ".env.local")),
  };
  for (const [key, value] of Object.entries(merged)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv) {
  let dryRun = false;
  let force = false;
  let root = path.join(ROOT, "public");
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--force") force = true;
    else if (arg === "--root") {
      const next = argv[++i];
      if (!next) {
        console.error("Missing value for --root");
        process.exit(1);
      }
      root = path.resolve(next);
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/upload-public-media-to-r2.mjs [--dry-run] [--force] [--root <public-dir>]",
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return { dryRun, force, root };
}

function walk(dir, keyPrefix) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    const key = `${keyPrefix}/${entry.name}`.replace(/\\/g, "/");
    if (entry.isDirectory()) files.push(...walk(abs, key));
    else if (entry.isFile()) files.push({ abs, key });
  }
  return files;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

async function main() {
  loadLocalEnv();
  const { dryRun, force, root } = parseArgs(process.argv.slice(2));
  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    console.error(
      `Missing R2 env: ${missing.join(", ")}\nSet them in the shell or in .env.local. Do not commit them.`,
    );
    process.exit(1);
  }

  const base = process.env.R2_PUBLIC_BASE_URL.trim().replace(/\/+$/, "");
  const bucket = process.env.R2_BUCKET_NAME.trim();
  const files = DIRS.flatMap((dir) => walk(path.join(root, dir), dir));
  if (files.length === 0) {
    console.error(
      `No media files under ${root}/{${DIRS.join(",")}}.\n` +
        "Restore the seed library from the commit that still has it, then rerun:\n" +
        "  mkdir -p /tmp/slop-media\n" +
        "  git archive origin/main public/videos public/thumbnails public/posters public/banners | tar -x -C /tmp/slop-media\n" +
        "  node scripts/upload-public-media-to-r2.mjs --root /tmp/slop-media/public",
    );
    process.exit(1);
  }

  const client = dryRun
    ? null
    : new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
        },
        forcePathStyle: true,
      });

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let bytes = 0;

  console.log(
    `${dryRun ? "Dry run" : "Uploading"} ${files.length} files from ${root} → ${base}/`,
  );

  await mapPool(files, 4, async (file) => {
    const ext = path.extname(file.key).toLowerCase();
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) {
      console.warn(`skip unsupported type ${file.key}`);
      skipped += 1;
      return;
    }
    const size = statSync(file.abs).size;
    const publicUrl = `${base}/${file.key}`;
    if (dryRun) {
      console.log(`would upload ${file.key} (${formatBytes(size)}) → ${publicUrl}`);
      uploaded += 1;
      bytes += size;
      return;
    }
    try {
      if (!force) {
        try {
          const head = await client.send(
            new HeadObjectCommand({ Bucket: bucket, Key: file.key }),
          );
          if (head.ContentLength === size) {
            console.log(`exists ${file.key} (${formatBytes(size)})`);
            skipped += 1;
            return;
          }
        } catch (err) {
          const status = err?.$metadata?.httpStatusCode;
          const name = err?.name;
          const missing =
            status === 404 || name === "NotFound" || name === "NoSuchKey";
          if (!missing) throw err;
        }
      }
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: file.key,
          Body: createReadStream(file.abs),
          ContentLength: size,
          ContentType: contentType,
          CacheControl: CACHE_CONTROL,
        }),
      );
      uploaded += 1;
      bytes += size;
      console.log(`uploaded ${file.key} (${formatBytes(size)})`);
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`failed ${file.key}: ${message}`);
    }
  });

  console.log(
    dryRun
      ? `Dry run. wouldUpload=${uploaded} skipped=${skipped} bytes=${formatBytes(bytes)}`
      : `Done. uploaded=${uploaded} skipped=${skipped} failed=${failed} bytes=${formatBytes(bytes)}`,
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
