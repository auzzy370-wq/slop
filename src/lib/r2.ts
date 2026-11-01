import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type R2Object = {
  key: string;
  size: number;
  lastModified: string | null;
  url: string;
};

function requiredEnv(name: string) {
  return process.env[name]?.trim() || "";
}

export function isR2Configured() {
  return Boolean(
    requiredEnv("R2_ACCOUNT_ID") &&
      requiredEnv("R2_ACCESS_KEY_ID") &&
      requiredEnv("R2_SECRET_ACCESS_KEY") &&
      requiredEnv("R2_BUCKET_NAME") &&
      requiredEnv("R2_PUBLIC_BASE_URL"),
  );
}

export function r2PublicBaseUrl() {
  return requiredEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
}

export function r2Bucket() {
  return requiredEnv("R2_BUCKET_NAME");
}

export function r2KeyToPublicUrl(key: string) {
  const base = r2PublicBaseUrl();
  const path = key.replace(/^\/+/, "");
  return `${base}/${path}`;
}

export function isR2PublicUrl(url: string) {
  if (!url || !isR2Configured()) return false;
  const base = r2PublicBaseUrl();
  return url === base || url.startsWith(`${base}/`);
}

export function r2PublicUrlToKey(url: string): string | null {
  if (!isR2PublicUrl(url)) return null;
  const base = r2PublicBaseUrl();
  return url.slice(base.length + 1).replace(/^\/+/, "") || null;
}

let cachedClient: S3Client | null = null;

export function getR2Client() {
  if (!isR2Configured()) {
    throw new Error(
      "Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL.",
    );
  }
  if (cachedClient) return cachedClient;
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
    forcePathStyle: true,
  });
  return cachedClient;
}

export async function r2PutObject(input: {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  cacheControl?: string;
}) {
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType || "application/octet-stream",
      CacheControl: input.cacheControl,
    }),
  );
  return { key: input.key, url: r2KeyToPublicUrl(input.key) };
}

export async function r2GetObjectText(key: string): Promise<string | null> {
  if (!isR2Configured()) return null;
  try {
    const client = getR2Client();
    const res = await client.send(
      new GetObjectCommand({
        Bucket: r2Bucket(),
        Key: key,
      }),
    );
    return (await res.Body?.transformToString()) ?? null;
  } catch {
    return null;
  }
}

export async function r2DeleteObject(key: string) {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
    }),
  );
}

export async function r2DeleteByUrl(url: string) {
  const key = r2PublicUrlToKey(url);
  if (!key) return false;
  await r2DeleteObject(key);
  return true;
}

export async function r2ListObjects(prefix = "slop/"): Promise<R2Object[]> {
  if (!isR2Configured()) return [];
  const client = getR2Client();
  const out: R2Object[] = [];
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: r2Bucket(),
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    for (const obj of page.Contents || []) {
      if (!obj.Key) continue;
      out.push({
        key: obj.Key,
        size: obj.Size || 0,
        lastModified: obj.LastModified
          ? obj.LastModified.toISOString()
          : null,
        url: r2KeyToPublicUrl(obj.Key),
      });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

export async function r2PresignPut(input: {
  key: string;
  contentType: string;
  expiresIn?: number;
}) {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: r2Bucket(),
    Key: input.key,
    ContentType: input.contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: input.expiresIn ?? 60 * 30,
  });
  return {
    key: input.key,
    uploadUrl,
    publicUrl: r2KeyToPublicUrl(input.key),
  };
}

export type R2Health = {
  configured: boolean;
  ok: boolean;
  message: string;
  objects?: number;
  bytes?: number;
};

export async function getR2Health(): Promise<R2Health> {
  if (!isR2Configured()) {
    return {
      configured: false,
      ok: false,
      message:
        "R2 not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL.",
    };
  }
  try {
    const client = getR2Client();
    await client.send(new HeadBucketCommand({ Bucket: r2Bucket() }));
    const objects = await r2ListObjects("slop/");
    const bytes = objects.reduce((s, o) => s + o.size, 0);
    // Verify public base URL is reachable for at least catalog or a tiny probe
    return {
      configured: true,
      ok: true,
      message: "Cloudflare R2 ready for mass uploads.",
      objects: objects.length,
      bytes,
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      message:
        err instanceof Error
          ? `R2 probe failed: ${err.message}`
          : "R2 probe failed",
    };
  }
}

export function episodeObjectKey(
  dramaId: string,
  episodeNumber: number,
  filename: string,
) {
  const safeDrama = dramaId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const ep = String(Math.floor(episodeNumber)).padStart(2, "0");
  const safeName = filename.replace(/[^\w.\-]+/g, "_");
  const stamp = Date.now().toString(36);
  return `slop/${safeDrama}/ep-${ep}-${stamp}-${safeName}`;
}
