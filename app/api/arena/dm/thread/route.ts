import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getOrCreateDmThread } from "@/lib/arenaSocial";

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const withUserId = String(body?.withUserId || "").trim();
  if (!withUserId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const db = getDb();
  const u = db.prepare("SELECT id FROM users WHERE id = ?").get(withUserId);
  if (!u) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const threadId = getOrCreateDmThread(db, session.id, withUserId);
  return NextResponse.json({ ok: true, threadId });
}
