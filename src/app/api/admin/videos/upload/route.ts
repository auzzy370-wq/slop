import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdminKey } from "@/lib/admin-guard";

/**
 * Local / self-hosted mass upload.
 * Writes MP4s under public/uploads/{dramaId}/ep-{n}.mp4
 * On Vercel without Blob, prefer /api/admin/videos/blob instead.
 */
export async function POST(request: Request) {
  const denied = requireAdminKey(request);
  if (denied) return denied;

  if (process.env.VERCEL === "1" && !process.env.ALLOW_LOCAL_UPLOAD_ON_VERCEL) {
    return NextResponse.json(
      {
        error: "use_blob",
        message:
          "On Vercel, set BLOB_READ_WRITE_TOKEN and use Blob uploads for mass MP4 import.",
      },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_form", message: "Could not read upload form." },
      { status: 400 },
    );
  }

  const dramaId = String(form.get("dramaId") ?? "").trim();
  const episodeNumber = Number(form.get("episodeNumber") ?? 0);
  const file = form.get("file");

  if (!dramaId || !Number.isFinite(episodeNumber) || episodeNumber < 1) {
    return NextResponse.json(
      { error: "invalid_meta", message: "dramaId and episodeNumber required." },
      { status: 400 },
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "missing_file", message: "MP4 file required." },
      { status: 400 },
    );
  }

  const type = file.type || "";
  const name = file.name.toLowerCase();
  if (!type.includes("mp4") && !name.endsWith(".mp4") && !type.includes("quicktime")) {
    return NextResponse.json(
      { error: "invalid_type", message: "Only MP4 (or MOV) video files are accepted." },
      { status: 400 },
    );
  }

  const safeDrama = dramaId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const ep = String(Math.floor(episodeNumber)).padStart(2, "0");
  const relDir = path.join("uploads", safeDrama);
  const absDir = path.join(process.cwd(), "public", relDir);
  const filename = `ep-${ep}.mp4`;
  const absPath = path.join(absDir, filename);
  const publicUrl = `/${relDir.replaceAll(path.sep, "/")}/${filename}`;

  try {
    await mkdir(absDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absPath, buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Write failed";
    return NextResponse.json(
      { error: "write_failed", message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    url: publicUrl,
    episodeNumber: Math.floor(episodeNumber),
    bytes: file.size,
  });
}
