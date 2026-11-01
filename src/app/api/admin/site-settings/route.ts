import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";
import { loadSiteSettings, saveSiteSettings } from "@/lib/site-settings";

export async function GET(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;
  const settings = await loadSiteSettings();
  return NextResponse.json({ ok: true, ...settings });
}

export async function POST(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;

  let body: {
    maintenanceMode?: boolean;
    maintenanceMessage?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const settings = await saveSiteSettings({
      maintenanceMode: body.maintenanceMode,
      maintenanceMessage: body.maintenanceMessage,
    });
    return NextResponse.json({
      ok: true,
      ...settings,
      message: settings.maintenanceMode
        ? "Maintenance mode ON — public visitors see the maintenance screen. Admins can still use the site."
        : "Maintenance mode OFF — site is public again.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "save_failed",
        message: err instanceof Error ? err.message : "Save failed",
      },
      { status: 500 },
    );
  }
}
