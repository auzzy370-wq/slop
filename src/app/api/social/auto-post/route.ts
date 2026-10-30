import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminKey } from "@/lib/admin-guard";
import { getSocialStatus, runEpisodeAutoPost } from "@/lib/social/service";

const schema = z.object({
  dramaId: z.string().min(1),
  dramaTitle: z.string().min(1),
  dramaSlug: z.string().min(1),
  episodeId: z.string().min(1),
  episodeNumber: z.number().int().positive(),
  episodeTitle: z.string().min(1),
  episodeSlug: z.string().min(1),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  force: z.boolean().optional(),
});

export async function GET() {
  const status = await getSocialStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const denied = requireAdminKey(request);
  // Allow without key locally; on Vercel require key when set (same as other admin APIs)
  if (denied && process.env.SLOP_ADMIN_KEY) return denied;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const result = await runEpisodeAutoPost(parsed.data);
  return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 502 });
}
