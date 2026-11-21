import { NextResponse } from "next/server";
import { isHostedRuntime } from "@/lib/runtime";

/**
 * Server-side gate for admin-only mutating APIs.
 *
 * - If SLOP_ADMIN_KEY is set: require header `x-slop-admin-key`.
 * - If unset on a public host (Vercel or Cloudflare): block admin write routes
 *   so a public demo cannot be freely mutated.
 * - Local/dev without the key: allow (demo mode).
 */
export function requireAdminKey(request: Request): NextResponse | null {
  const expected = process.env.SLOP_ADMIN_KEY;
  const got = request.headers.get("x-slop-admin-key");

  if (expected) {
    if (got !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return null;
  }

  if (isHostedRuntime()) {
    return NextResponse.json(
      {
        error: "admin_writes_locked",
        message:
          "Set SLOP_ADMIN_KEY to enable admin write APIs on the public deployment.",
      },
      { status: 403 },
    );
  }

  return null;
}
