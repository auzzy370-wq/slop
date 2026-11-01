import { getBlobHealth } from "@/lib/admin/blob-health";
import { getR2Health, isR2Configured, r2ListObjects } from "@/lib/r2";
import {
  getSupabaseStorageHealth,
  isSupabaseStorageConfigured,
  listSupabaseVideoUsage,
} from "@/lib/supabase/storage";

export type StorageProviderId = "r2" | "supabase" | "blob";

/** Soft free-tier ceilings we try not to blow past (bytes). */
export const FREE_TIER_BYTES: Record<StorageProviderId, number> = {
  r2: 10 * 1024 * 1024 * 1024, // Cloudflare R2 free: 10 GB / month
  supabase: 1 * 1024 * 1024 * 1024, // Supabase free: 1 GB
  blob: 512 * 1024 * 1024, // Vercel Hobby Blob soft budget before suspend risk
};

export type ProviderPoolStatus = {
  id: StorageProviderId;
  label: string;
  configured: boolean;
  ok: boolean;
  suspended?: boolean;
  objects: number;
  bytes: number;
  freeBytes: number;
  limitBytes: number;
  usedRatio: number;
  message: string;
};

export type FreeStoragePool = {
  providers: ProviderPoolStatus[];
  preferred: StorageProviderId | "none";
  order: StorageProviderId[];
  totalFreeBytes: number;
  totalUsedBytes: number;
  totalLimitBytes: number;
  message: string;
};

function fmt(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Snapshot every free-tier backend we support and pick spillover order:
 * R2 (10GB) → Supabase (1GB) → Vercel Blob (when not suspended).
 */
export async function getFreeStoragePool(): Promise<FreeStoragePool> {
  const [r2Health, supabaseHealth, blobHealth] = await Promise.all([
    getR2Health(),
    getSupabaseStorageHealth(),
    process.env.BLOB_READ_WRITE_TOKEN
      ? getBlobHealth({ probeWrite: false })
      : Promise.resolve({
          configured: false,
          listOk: false,
          writeOk: false,
          readOk: false,
          suspended: false,
          message: "Blob not configured",
          objects: 0,
          bytes: 0,
        }),
  ]);

  let r2Bytes = r2Health.bytes ?? 0;
  let r2Objects = r2Health.objects ?? 0;
  if (r2Health.ok && isR2Configured()) {
    try {
      const objects = await r2ListObjects("slop/");
      r2Objects = objects.length;
      r2Bytes = objects.reduce((s, o) => s + o.size, 0);
    } catch {
      /* keep health probe numbers */
    }
  }

  let supabaseBytes = supabaseHealth.bytes ?? 0;
  let supabaseObjects = supabaseHealth.objects ?? 0;
  if (supabaseHealth.ok && isSupabaseStorageConfigured()) {
    try {
      const usage = await listSupabaseVideoUsage();
      supabaseBytes = usage.bytes;
      supabaseObjects = usage.objects;
    } catch {
      /* keep probe */
    }
  }

  const blobBytes = blobHealth.bytes ?? 0;
  const blobObjects = blobHealth.objects ?? 0;
  const blobOk =
    blobHealth.configured &&
    Boolean(blobHealth.writeOk) &&
    !blobHealth.suspended;

  const providers: ProviderPoolStatus[] = [
    {
      id: "r2",
      label: "Cloudflare R2",
      configured: r2Health.configured,
      ok: r2Health.ok,
      objects: r2Objects,
      bytes: r2Bytes,
      limitBytes: FREE_TIER_BYTES.r2,
      freeBytes: Math.max(0, FREE_TIER_BYTES.r2 - r2Bytes),
      usedRatio: Math.min(1, r2Bytes / FREE_TIER_BYTES.r2),
      message: r2Health.message,
    },
    {
      id: "supabase",
      label: "Supabase Storage",
      configured: supabaseHealth.configured,
      ok: supabaseHealth.ok,
      objects: supabaseObjects,
      bytes: supabaseBytes,
      limitBytes: FREE_TIER_BYTES.supabase,
      freeBytes: Math.max(0, FREE_TIER_BYTES.supabase - supabaseBytes),
      usedRatio: Math.min(1, supabaseBytes / FREE_TIER_BYTES.supabase),
      message: supabaseHealth.message,
    },
    {
      id: "blob",
      label: "Vercel Blob",
      configured: blobHealth.configured,
      ok: blobOk,
      suspended: blobHealth.suspended,
      objects: blobObjects,
      bytes: blobBytes,
      limitBytes: FREE_TIER_BYTES.blob,
      freeBytes: blobOk
        ? Math.max(0, FREE_TIER_BYTES.blob - blobBytes)
        : 0,
      usedRatio: Math.min(1, blobBytes / FREE_TIER_BYTES.blob),
      message: blobHealth.message,
    },
  ];

  // Prefer the healthy provider with the most remaining free-tier headroom.
  const usable = providers
    .filter((p) => p.ok && p.freeBytes > 32 * 1024 * 1024)
    .sort((a, b) => b.freeBytes - a.freeBytes);

  const order = usable.map((p) => p.id);
  const preferred: StorageProviderId | "none" = usable[0]
    ? usable[0].id
    : "none";

  const totalFreeBytes = providers
    .filter((p) => p.ok)
    .reduce((s, p) => s + p.freeBytes, 0);
  const totalUsedBytes = providers.reduce((s, p) => s + p.bytes, 0);
  const totalLimitBytes = providers
    .filter((p) => p.configured || p.ok)
    .reduce((s, p) => s + p.limitBytes, 0);

  let message = "No free-tier cloud storage is ready.";
  if (preferred !== "none") {
    const names = usable.map((p) => p.label).join(" → ");
    message = `Free-tier pool ready. Auto order: ${names}. ~${fmt(totalFreeBytes)} combined free soft capacity.`;
  } else if (providers.some((p) => p.configured && !p.ok)) {
    message = providers
      .filter((p) => p.configured && !p.ok)
      .map((p) => p.message)
      .join(" · ");
  }

  return {
    providers,
    preferred,
    order,
    totalFreeBytes,
    totalUsedBytes,
    totalLimitBytes,
    message,
  };
}

export function pickProviderForUpload(
  pool: FreeStoragePool,
  requested?: StorageProviderId | "auto" | "local",
): StorageProviderId | "local" | "none" {
  if (requested === "local") return "local";
  if (requested && requested !== "auto") {
    const hit = pool.providers.find((p) => p.id === requested);
    if (hit?.ok) return requested;
    // fall through to auto if forced target is unhealthy
  }
  return pool.preferred === "none" ? "none" : pool.preferred;
}
