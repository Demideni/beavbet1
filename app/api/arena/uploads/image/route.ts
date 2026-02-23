import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";

function dataDir() {
  return (
    process.env.DB_PATH
      ? path.dirname(process.env.DB_PATH)
      : (process.env.RENDER_DISK_PATH ||
          process.env.BEAVBET_DATA_DIR ||
          (process.env.RENDER ? "/var/data" : path.join(process.cwd(), "data")))
  );
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "EXPECTED_MULTIPART" }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "BAD_FORM" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "NO_FILE" }, { status: 400 });

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "ONLY_IMAGES" }, { status: 400 });
  }

  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) return NextResponse.json({ ok: false, error: "TOO_LARGE" }, { status: 400 });

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const safeExt = ext && /^[a-z0-9]{1,6}$/.test(ext) ? ext : (file.type.split("/")[1] || "png");
  const name = `${randomUUID()}.${safeExt}`;

  const dir = path.join(dataDir(), "uploads");
  fs.mkdirSync(dir, { recursive: true });

  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(dir, name), buf);

  return NextResponse.json({ ok: true, name, url: `/api/arena/uploads/${encodeURIComponent(name)}` });
}
