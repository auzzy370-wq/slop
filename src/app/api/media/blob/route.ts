import { NextResponse } from "next/server";
import { isVercelBlobUrl } from "@/lib/media-url";

/**
 * Authenticated Vercel Blob proxy.
 * Keeps existing episode playback working when the public Blob CDN is
 * suspended/blocked — no reupload required. Only allows Blob store hosts.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("u")?.trim() || "";
  if (!target || !isVercelBlobUrl(target)) {
    return NextResponse.json(
      { error: "invalid_url", message: "Only Vercel Blob URLs can be proxied." },
      { status: 400 },
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Fall through to public fetch — may still work if store isn't suspended.
  }

  const range = request.headers.get("range") || undefined;

  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { get } = await import("@vercel/blob");
      const result = await get(target, {
        access: "public",
        useCache: true,
        headers: range ? { Range: range } : undefined,
      });

      if (result?.statusCode === 200 && result.stream) {
        const headers = new Headers();
        headers.set(
          "Content-Type",
          result.blob.contentType || "video/mp4",
        );
        headers.set(
          "Cache-Control",
          "public, max-age=3600, stale-while-revalidate=86400",
        );
        headers.set("Accept-Ranges", "bytes");
        if (result.blob.size != null) {
          headers.set("Content-Length", String(result.blob.size));
        }
        // Forward useful headers from origin when present
        const len = result.headers.get("content-length");
        const cr = result.headers.get("content-range");
        const etag = result.headers.get("etag");
        if (len) headers.set("Content-Length", len);
        if (cr) headers.set("Content-Range", cr);
        if (etag) headers.set("ETag", etag);
        const status = cr ? 206 : 200;
        return new NextResponse(result.stream, { status, headers });
      }

      if (result?.statusCode === 304) {
        return new NextResponse(null, { status: 304 });
      }
    }

    const upstream = await fetch(target, {
      headers: range ? { Range: range } : undefined,
      cache: "no-store",
    });

    if (!upstream.ok && upstream.status !== 206) {
      const probe = await upstream.text().catch(() => "");
      if (
        /store (is )?blocked|has been suspended|limits-exceeded/i.test(probe)
      ) {
        return NextResponse.json(
          {
            error: "blob_suspended",
            message:
              "Vercel Blob is suspended. Run Admin → Migrate Blob → R2 (no reupload) after setting R2_* credentials.",
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        {
          error: "blob_fetch_failed",
          message: `Upstream Blob HTTP ${upstream.status}`,
        },
        { status: 502 },
      );
    }

    const headers = new Headers();
    const pass = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
    ];
    for (const h of pass) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "video/mp4");
    }
    headers.set(
      "Cache-Control",
      "public, max-age=3600, stale-while-revalidate=86400",
    );

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "proxy_failed",
        message: err instanceof Error ? err.message : "Blob proxy failed",
      },
      { status: 502 },
    );
  }
}
