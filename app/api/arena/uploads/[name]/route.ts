import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
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

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { name } = await ctx.params;
  const fileName = String(name || "");
  if (!/^[a-f0-9\-]{36}\.[a-z0-9]{1,6}$/i.test(fileName)) {
    return NextResponse.json({ ok: false, error: "BAD_NAME" }, { status: 400 });
  }

  const full = path.join(dataDir(), "uploads", fileName);
  if (!fs.existsSync(full)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const buf = fs.readFileSync(full);
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mime =
    ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
    ext === "webp" ? "image/webp" :
    ext === "gif" ? "image/gif" :
    "image/png";

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
