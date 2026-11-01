import { getAdsPublicConfig } from "@/lib/ads/config";

export const instant = false;

/**
 * AdSense (and other authorized sellers) read /ads.txt from the site root.
 * When a publisher id is configured we emit the standard Google line.
 */
export async function GET() {
  const ads = getAdsPublicConfig();
  const lines: string[] = [
    "# SLOP ads.txt — authorized digital sellers",
  ];

  if (ads.clientId) {
    const pub = ads.clientId.replace(/^ca-pub-/i, "");
    lines.push(`google.com, pub-${pub}, DIRECT, f08c47fec0942fa0`);
  } else {
    lines.push("# Set NEXT_PUBLIC_ADS_CLIENT_ID to publish your AdSense seller line.");
  }

  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
