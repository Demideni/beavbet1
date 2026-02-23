import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getUploadsDir } from "../_util";

function guessContentType(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".webm") return "audio/webm";
  if (ext === ".mp4" || ext === ".m4a") return "audio/mp4";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const u = await getSessionUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await ctx.params;
  const safeName = path.basename(name); // prevents traversal
  const filePath = path.join(getUploadsDir(), safeName);

  try {
    const buf = await fs.readFile(filePath);
    const ct = guessContentType(safeName);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
