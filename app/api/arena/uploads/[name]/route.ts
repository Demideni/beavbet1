import fs from "node:fs";
import path from "node:path";
import { getSessionUser } from "@/lib/auth";
import { contentTypeFromName, getUploadsDir } from "../_util";

export async function GET(_: Request, ctx: { params: Promise<{ name: string }> }) {
  const session = await getSessionUser();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { name } = await ctx.params;
  const safe = path.basename(String(name || ""));
  if (!safe) return new Response("Not found", { status: 404 });

  const filePath = path.join(getUploadsDir(), safe);
  if (!fs.existsSync(filePath)) return new Response("Not found", { status: 404 });

  const buf = fs.readFileSync(filePath);
  return new Response(buf, {
    headers: {
      "Content-Type": contentTypeFromName(safe),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
