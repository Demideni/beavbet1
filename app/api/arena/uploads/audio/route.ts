import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getUploadsDir } from "../_util";

function extFor(mime: string) {
  const m = (mime || "").toLowerCase();
  if (m.includes("webm")) return ".webm";
  if (m.includes("mp4") || m.includes("m4a")) return ".mp4";
  if (m.includes("mpeg") || m.includes("mp3")) return ".mp3";
  if (m.includes("wav")) return ".wav";
  if (m.includes("ogg")) return ".ogg";
  return ".webm";
}

export async function POST(req: NextRequest) {
  const u = await getSessionUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}${extFor(file.type)}`;
  const full = path.join(getUploadsDir(), filename);

  await fs.writeFile(full, buf);
  return NextResponse.json({ ok: true, url: `/api/arena/uploads/${filename}` });
}
