import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getSessionUser } from "@/lib/auth";
import { getUploadsDir } from "../_util";

export const runtime = "nodejs";

function extFromMime(mime: string) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("png")) return ".png";
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  if (m.includes("gif")) return ".gif";
  if (m.includes("webp")) return ".webp";
  return ".png";
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "NO_FILE" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 10 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "TOO_BIG" }, { status: 400 });
  }

  const ext = extFromMime(file.type);
  const name = `${randomUUID()}${ext}`;
  const full = path.join(getUploadsDir(), name);
  fs.writeFileSync(full, buf);

  return NextResponse.json({ ok: true, url: `/api/arena/uploads/${name}`, name });
}
