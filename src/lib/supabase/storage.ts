import { createClient } from "@supabase/supabase-js";

export const SUPABASE_VIDEO_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET?.trim() || "slop-videos";

export function isSupabaseStorageConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Supabase Storage needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isSupabasePublicUrl(url: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url || !base) return false;
  try {
    return (
      url.startsWith(`${base.replace(/\/+$/, "")}/storage/v1/object/public/`) ||
      url.startsWith(`${base.replace(/\/+$/, "")}/storage/v1/object/sign/`)
    );
  } catch {
    return false;
  }
}

export function supabasePublicUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/+$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing");
  const key = path.replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${SUPABASE_VIDEO_BUCKET}/${key}`;
}

export async function ensureSupabaseVideoBucket() {
  const sb = serviceClient();
  const { data: buckets } = await sb.storage.listBuckets();
  const exists = (buckets || []).some((b) => b.name === SUPABASE_VIDEO_BUCKET);
  if (!exists) {
    const { error } = await sb.storage.createBucket(SUPABASE_VIDEO_BUCKET, {
      public: true,
      fileSizeLimit: "512MB",
      allowedMimeTypes: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"],
    });
    if (error && !/already exists/i.test(error.message)) {
      throw error;
    }
  }
}

export type SupabaseStorageHealth = {
  configured: boolean;
  ok: boolean;
  message: string;
  objects?: number;
  bytes?: number;
};

export async function getSupabaseStorageHealth(): Promise<SupabaseStorageHealth> {
  if (!isSupabaseStorageConfigured()) {
    return {
      configured: false,
      ok: false,
      message:
        "Supabase Storage not configured — set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (1 GB free).",
    };
  }
  try {
    await ensureSupabaseVideoBucket();
    const usage = await listSupabaseVideoUsage();
    return {
      configured: true,
      ok: true,
      message: "Supabase Storage ready (free tier spillover).",
      objects: usage.objects,
      bytes: usage.bytes,
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      message:
        err instanceof Error
          ? `Supabase Storage probe failed: ${err.message}`
          : "Supabase Storage probe failed",
    };
  }
}

async function listPrefix(prefix: string) {
  const sb = serviceClient();
  const out: Array<{ name: string; size: number; path: string }> = [];
  const queue = [prefix.replace(/^\/+|\/+$/g, "")];
  const seen = new Set<string>();

  while (queue.length) {
    const folder = queue.shift()!;
    if (seen.has(folder)) continue;
    seen.add(folder);
    const { data, error } = await sb.storage.from(SUPABASE_VIDEO_BUCKET).list(
      folder,
      { limit: 1000, offset: 0 },
    );
    if (error) throw error;
    for (const item of data || []) {
      const path = folder ? `${folder}/${item.name}` : item.name;
      const isFolder = !item.id || item.metadata == null;
      // Supabase marks folders loosely — if no metadata.size treat as folder when id null
      if (item.id == null && (item.metadata as { size?: number } | null)?.size == null) {
        // could be empty folder or file without metadata; check size
      }
      const size = Number((item.metadata as { size?: number } | null)?.size || 0);
      if (size > 0 || /\.(mp4|mov|webm|m4v|json|txt)$/i.test(item.name)) {
        out.push({ name: item.name, size, path });
      } else if (!/\./.test(item.name) || item.id == null) {
        queue.push(path);
      }
    }
  }
  return out;
}

export async function listSupabaseVideoUsage() {
  if (!isSupabaseStorageConfigured()) {
    return { objects: 0, bytes: 0, files: [] as Array<{ path: string; size: number }> };
  }
  const files = await listPrefix("slop");
  const bytes = files.reduce((s, f) => s + (f.size || 0), 0);
  return {
    objects: files.length,
    bytes,
    files: files.map((f) => ({ path: f.path, size: f.size })),
  };
}

export function episodeSupabaseKey(
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

export async function createSupabaseSignedUpload(input: {
  key: string;
  upsert?: boolean;
}) {
  await ensureSupabaseVideoBucket();
  const sb = serviceClient();
  const { data, error } = await sb.storage
    .from(SUPABASE_VIDEO_BUCKET)
    .createSignedUploadUrl(input.key, { upsert: Boolean(input.upsert) });
  if (error || !data) {
    throw new Error(error?.message || "Supabase signed upload URL failed");
  }
  return {
    key: input.key,
    uploadUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl: supabasePublicUrl(input.key),
  };
}

export async function deleteSupabaseObjectByUrl(url: string) {
  if (!isSupabasePublicUrl(url) || !isSupabaseStorageConfigured()) return false;
  const marker = `/object/public/${SUPABASE_VIDEO_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return false;
  const key = decodeURIComponent(url.slice(idx + marker.length));
  const sb = serviceClient();
  const { error } = await sb.storage.from(SUPABASE_VIDEO_BUCKET).remove([key]);
  if (error) throw error;
  return true;
}
