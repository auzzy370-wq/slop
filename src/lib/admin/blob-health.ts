export type BlobHealth = {
  configured: boolean;
  listOk: boolean;
  writeOk: boolean;
  readOk: boolean;
  suspended: boolean;
  message: string;
  objects?: number;
  bytes?: number;
};

/**
 * Probe Vercel Blob: list metadata, public read, and optionally a tiny write.
 * Suspended/blocked stores often still list, but reads/writes fail.
 */
export async function getBlobHealth(opts?: {
  probeWrite?: boolean;
}): Promise<BlobHealth> {
  const probeWrite = opts?.probeWrite !== false;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      configured: false,
      listOk: false,
      writeOk: false,
      readOk: false,
      suspended: false,
      message: "BLOB_READ_WRITE_TOKEN is not set.",
    };
  }

  let listOk = false;
  let readOk = false;
  let writeOk = false;
  let suspended = false;
  let message = "Blob ready.";
  let objects = 0;
  let bytes = 0;
  const errors: string[] = [];

  try {
    const { list } = await import("@vercel/blob");
    const page = await list({ prefix: "slop/", limit: 1000 });
    listOk = true;
    objects = page.blobs.length;
    bytes = page.blobs.reduce((s, b) => s + (b.size || 0), 0);

    const sample =
      page.blobs.find((b) => b.pathname === "slop/catalog/uploads.json") ||
      page.blobs.find((b) => /\.(mp4|json)$/i.test(b.pathname)) ||
      page.blobs[0];

    if (sample?.url) {
      try {
        const res = await fetch(sample.url, {
          method: "GET",
          cache: "no-store",
          headers: { Range: "bytes=0-16" },
        });
        const text = await res.text().catch(() => "");
        if (
          res.status === 403 ||
          /store (is )?blocked|has been suspended/i.test(text)
        ) {
          readOk = false;
          suspended = true;
          errors.push("Public Blob reads return blocked/suspended.");
        } else if (res.ok || res.status === 206) {
          readOk = true;
        } else {
          errors.push(`Blob read HTTP ${res.status}`);
        }
      } catch (err) {
        errors.push(
          err instanceof Error ? `Blob read failed: ${err.message}` : "Blob read failed",
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    if (/suspended|blocked/i.test(msg)) suspended = true;
  }

  if (probeWrite) {
    try {
      const { put, del } = await import("@vercel/blob");
      const probe = await put(
        `slop/_health/probe-${Date.now()}.txt`,
        `slop-health ${new Date().toISOString()}`,
        {
          access: "public",
          addRandomSuffix: false,
          contentType: "text/plain",
          cacheControlMaxAge: 0,
        },
      );
      writeOk = true;
      try {
        await del(probe.url);
      } catch {
        /* probe cleanup best-effort */
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      if (/suspended|blocked/i.test(msg)) suspended = true;
    }
  } else if (suspended) {
    writeOk = false;
  } else if (listOk && readOk) {
    writeOk = true;
  }

  if (suspended) {
    message =
      "Vercel Blob store is suspended/blocked. Uploads and video playback from Blob will fail until you unsuspend or create a new store in the Vercel dashboard, then update BLOB_READ_WRITE_TOKEN.";
  } else if (!listOk && !writeOk) {
    message = errors[0] || "Blob probe failed.";
  } else if (!writeOk) {
    message =
      errors.find((e) => /suspended|blocked|put|write/i.test(e)) ||
      "Blob writes are failing.";
  } else if (!readOk) {
    message =
      "Blob writes work but public reads failed — check store access settings.";
  }

  return {
    configured: true,
    listOk,
    writeOk,
    readOk,
    suspended: suspended || (!writeOk && /suspended|blocked/i.test(message)),
    message,
    objects,
    bytes,
  };
}

export function isBlobSuspendedError(raw: string) {
  return /store has been suspended|store is blocked|blob.*suspended|suspended.*blob/i.test(
    raw,
  );
}
