import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getUploadsDir } from "../_util";

function extFor(mime: string) {
  const m = (mime || "").toLowerCase();
  if (m.includes("png")) return ".png";
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  if (m.includes("gif")) return ".gif";
  if (m.includes("webp")) return ".webp";
  return ".png";
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
