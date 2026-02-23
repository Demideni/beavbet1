import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getSessionUser } from "@/lib/auth";

// Stores user-uploaded audio on the server disk.
// On Render, use a persistent disk mount (see lib/db.ts for DATA_DIR conventions).

function getUploadsDir() {
  // Keep consistent with lib/db.ts DATA_DIR selection.
  const base =
    process.env.RENDER_DISK_PATH ||
    process.env.BEAVBET_DATA_DIR ||
    (process.env.RENDER ? "/var/data" : path.join(process.cwd(), "data"));
  const dir = path.join(base, "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  // @ts-ignore - File exists in runtime
  const f: File = file;
  const size = Number((f as any).size || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ ok: false, error: "EMPTY" }, { status: 400 });
  }
  // ~5MB max
  if (size > 5 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "TOO_LARGE" }, { status: 413 });
  }

  const ext = (f.type || "").includes("mp4") ? "mp4" : "webm";
  const name = `${randomUUID()}.${ext}`;
  const outPath = path.join(getUploadsDir(), name);

  const buf = Buffer.from(await f.arrayBuffer());
  fs.writeFileSync(outPath, buf);

  return NextResponse.json({ ok: true, url: `/api/arena/uploads/${encodeURIComponent(name)}` });
}
