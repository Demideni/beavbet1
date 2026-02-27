import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb, uuid } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const idParam = String(searchParams.get("id") || "").trim();
  const targetUserId = idParam || session.id;
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 30)));

  const db = getDb();
  const u = db.prepare("SELECT id FROM users WHERE id=?").get(targetUserId);
  if (!u) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const rows = db
    .prepare(
      `SELECT id, user_id, text, image_url, created_at
       FROM arena_room_posts
       WHERE user_id=?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(targetUserId, limit)
    .map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      text: r.text ?? "",
      imageUrl: r.image_url ?? null,
      createdAt: Number(r.created_at || 0),
    }));

  return NextResponse.json({ ok: true, posts: rows });
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = String(body?.text || "").trim();
  const imageUrl = String(body?.imageUrl || "").trim() || null;

  if (!text && !imageUrl) {
    return NextResponse.json({ ok: false, error: "EMPTY_POST" }, { status: 400 });
  }

  const db = getDb();
  const id = uuid();
  const now = Date.now();

  db.prepare(
    "INSERT INTO arena_room_posts (id, user_id, text, image_url, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, session.id, text || null, imageUrl, now);

  // Feed event
  try {
    db.prepare(
      "INSERT INTO arena_feed_events (id, kind, actor_user_id, target_user_id, ref_id, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(uuid(), "post_create", session.id, null, id, JSON.stringify({ text: text || null, imageUrl }), now);
  } catch {}

  return NextResponse.json({ ok: true, id });
}