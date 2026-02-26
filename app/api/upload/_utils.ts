import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type UploadFolder = "avatars" | "rooms" | "posts";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function handleImageUpload(req: NextRequest, folder: UploadFolder) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ ok: false, error: "NO_FILE" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, error: "BAD_TYPE" }, { status: 400 });
  }

  // hard server cap; client also compresses
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "TOO_LARGE" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
  const filename = `${randomUUID()}.${ext}`;

  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadDir, { recursive: true });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  await writeFile(path.join(uploadDir, filename), buffer);

  return NextResponse.json({ ok: true, url: `/uploads/${folder}/${filename}` });
}