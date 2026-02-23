import fs from "node:fs";
import path from "node:path";
import { getSessionUser } from "@/lib/auth";

function getUploadsDir() {
  const base =
    process.env.RENDER_DISK_PATH ||
    process.env.BEAVBET_DATA_DIR ||
    (process.env.RENDER ? "/var/data" : path.join(process.cwd(), "data"));
  return path.join(base, "uploads");
}

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  // Protect uploads behind auth (these are private DMs).
  const session = await getSessionUser();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { name } = await ctx.params;
  const safe = String(name || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe) return new Response("Not found", { status: 404 });

  const filePath = path.join(getUploadsDir(), safe);
  if (!fs.existsSync(filePath)) return new Response("Not found", { status: 404 });

  const stat = fs.statSync(filePath);
  const ext = safe.split(".").pop()?.toLowerCase();
  const contentType = ext === "mp4" ? "audio/mp4" : "audio/webm";
  const stream = fs.createReadStream(filePath);
  return new Response(stream as any, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
