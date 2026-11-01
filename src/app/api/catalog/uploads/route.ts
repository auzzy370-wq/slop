import { NextResponse } from "next/server";
import { loadUploadsCatalog } from "@/lib/uploads-catalog";

/** Public read of admin-uploaded dramas/episodes overlay. */
export async function GET() {
  try {
    const catalog = await loadUploadsCatalog();
    return NextResponse.json(catalog, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json(
      { version: 1, updatedAt: null, dramas: [], videos: [], error: message },
      { status: 200 },
    );
  }
}
