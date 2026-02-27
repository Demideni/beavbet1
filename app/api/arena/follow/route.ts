import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb, uuid } from "@/lib/db";

// POST { targetUserId: string, action?: "follow" | "unfollow" }
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetUserId = String(body?.targetUserId || "").trim();
  const action = (String(body?.action || "follow").trim() || "follow") as "follow" | "unfollow";

  if (!targetUserId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  if (targetUserId === session.id) return NextResponse.json({ ok: false, error: "CANNOT_FOLLOW_SELF" }, { status: 400 });

  const db = getDb();
  const existsUser = db.prepare("SELECT id FROM users WHERE id=?").get(targetUserId);
  if (!existsUser) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const now = Date.now();

  if (action === "unfollow") {
    db.prepare("DELETE FROM arena_follows WHERE follower_id=? AND followee_id=?").run(session.id, targetUserId);
    return NextResponse.json({ ok: true, following: false });
  }

  db.prepare(
    "INSERT OR IGNORE INTO arena_follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)"
  ).run(session.id, targetUserId, now);

  // feed event
  db.prepare(
    "INSERT INTO arena_feed_events (id, kind, actor_user_id, target_user_id, ref_id, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(uuid(), "follow", session.id, targetUserId, null, null, now);

  return NextResponse.json({ ok: true, following: true });
}

// GET -> list of followee user ids
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const db = getDb();
  const rows = db
    .prepare("SELECT followee_id, created_at FROM arena_follows WHERE follower_id=? ORDER BY created_at DESC LIMIT 500")
    .all(session.id)
    .map((r: any) => ({ userId: r.followee_id, createdAt: Number(r.created_at || 0) }));

  return NextResponse.json({ ok: true, following: rows });
}