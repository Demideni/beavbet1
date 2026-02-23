import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { getSessionUser } from "@/lib/auth";

import path from "node:path";
import fs from "node:fs";

function getDataDir() {
  // Mirror lib/db.ts rules
  const fromDbPath = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : null;
  return (
    fromDbPath ||
    process.env.RENDER_DISK_PATH ||
    process.env.BEAVBET_DATA_DIR ||
    (process.env.RENDER ? "/var/data" : path.join(process.cwd(), "data"))
  );
}

function ensureUploadsDir() {
  const dir = path.join(getDataDir(), "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function contentTypeByExt(ext: string) {
  const e = ext.toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".webp") return "image/webp";
  if (e === ".gif") return "image/gif";
  if (e === ".mp3") return "audio/mpeg";
  if (e === ".wav") return "audio/wav";
  if (e === ".m4a") return "audio/mp4";
  if (e === ".mp4") return "audio/mp4";
  if (e === ".webm") return "audio/webm";
  return "application/octet-stream";
}


export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "NO_FILE" }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) return NextResponse.json({ ok: false, error: "TOO_LARGE" }, { status: 400 });

  const mime = (file.type || "").toLowerCase();
  const ok = mime.startsWith("audio/") || mime === "video/mp4" || mime === "application/octet-stream";
  if (!ok) return NextResponse.json({ ok: false, error: "BAD_TYPE" }, { status: 400 });

  // Choose extension from mime, fallback to .webm
  const ext =
    mime.includes("mp4") || mime.includes("m4a") ? ".mp4" :
    mime.includes("mpeg") || mime.includes("mp3") ? ".mp3" :
    mime.includes("wav") ? ".wav" :
    ".webm";

  const name = `${randomUUID()}${ext}`;
  const dir = ensureUploadsDir();
  const ab = await file.arrayBuffer();
  fs.writeFileSync(path.join(dir, name), Buffer.from(ab));

  return NextResponse.json({ ok: true, url: `/api/arena/uploads/${name}`, name });
}
