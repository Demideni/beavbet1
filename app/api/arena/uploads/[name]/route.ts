import { NextResponse } from "next/server";
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


export async function GET(_: Request, ctx: { params: Promise<{ name: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { name } = await ctx.params;
  const safe = String(name || "");
  // basic traversal protection
  if (!safe || safe.includes("..") || safe.includes("/") || safe.includes("\\")) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const dir = ensureUploadsDir();
  const filePath = path.join(dir, safe);
  if (!fs.existsSync(filePath)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const ext = path.extname(safe);
  const ct = contentTypeByExt(ext);
  const buf = fs.readFileSync(filePath);
  return new Response(buf, {
    headers: {
      "Content-Type": ct,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
