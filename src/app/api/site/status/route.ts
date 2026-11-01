import { NextResponse } from "next/server";
import { loadSiteSettings } from "@/lib/site-settings";

/** Public site status — used by MaintenanceGate. */
export async function GET() {
  try {
    const settings = await loadSiteSettings();
    return NextResponse.json(
      {
        ok: true,
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
        updatedAt: settings.updatedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({
      ok: true,
      maintenanceMode: false,
      maintenanceMessage: "",
      updatedAt: null,
    });
  }
}
