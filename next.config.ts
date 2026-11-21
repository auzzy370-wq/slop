import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/**
 * Public CDN base only — never the secret keys. Inlined so the client catalog
 * and these redirects use the same origin as server renders.
 * Falls back to a relative `/videos` path when unset (local `public/`).
 */
const r2PublicBaseUrl = (
  process.env.R2_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
  ""
)
  .trim()
  .replace(/\/+$/, "");

function r2RemotePattern(): Array<{
  protocol: "http" | "https";
  hostname: string;
}> {
  if (!r2PublicBaseUrl) return [];
  try {
    const url = new URL(r2PublicBaseUrl);
    const protocol = url.protocol === "http:" ? "http" : "https";
    return [{ protocol, hostname: url.hostname }];
  } catch {
    return [];
  }
}

const SEED_MEDIA_DIRS = ["videos", "thumbnails", "posters", "banners"] as const;

const nextConfig: NextConfig = {
  // Cache Components hang or 500 on Cloudflare Workers (OpenNext tracks this
  // in opennextjs-cloudflare#1318). Keep the standard Next renderer.
  cacheComponents: false,
  partialPrefetching: false,
  env: {
    NEXT_PUBLIC_R2_PUBLIC_BASE_URL: r2PublicBaseUrl,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "commondatastorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      ...r2RemotePattern(),
    ],
    // Posters and thumbnails are plain <img> tags aimed at R2 (or local
    // public/). Do not run them through `/_next/image`.
    unoptimized: true,
  },
  async redirects() {
    if (!r2PublicBaseUrl) return [];
    return SEED_MEDIA_DIRS.map((dir) => ({
      source: `/${dir}/:path*`,
      destination: `${r2PublicBaseUrl}/${dir}/:path*`,
      permanent: true,
    }));
  },
  async headers() {
    const staticCache =
      "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/favicon.svg",
        headers: [{ key: "Cache-Control", value: staticCache }],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: staticCache }],
      },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: staticCache }],
      },
      {
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: staticCache }],
      },
    ];
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
