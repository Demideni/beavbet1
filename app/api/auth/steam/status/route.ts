import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const db = getDb();
  const row = db.prepare("SELECT steam_id FROM steam_links WHERE user_id=?").get(user.id) as
    | { steam_id: string }
    | undefined;

  return NextResponse.json({ ok: true, steamId: row?.steam_id ?? null });
}
