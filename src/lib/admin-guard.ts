import { NextResponse } from "next/server";

/**
 * Server-side gate for admin-only mutating APIs.
 *
 * - If SLOP_ADMIN_KEY is set: require header `x-slop-admin-key`.
 * - If unset on Vercel: block admin write routes (campaigns, ad-revenue import,
 *   referral admin actions) so a public demo cannot be freely mutated.
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

  if (process.env.VERCEL === "1") {
    return NextResponse.json(
      {
        error: "admin_writes_locked",
        message:
          "Set SLOP_ADMIN_KEY in Vercel env to enable admin write APIs on the public deployment.",
      },
      { status: 403 },
    );
  }

  return null;
}
