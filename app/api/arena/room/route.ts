import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb, uuid } from "@/lib/db";
import { getArenaProfile } from "@/lib/arenaDuels";

function computePlace(db: any, elo: number) {
  const row = db
    .prepare("SELECT COUNT(1) AS c FROM arena_ratings WHERE dam_rank > ?")
    .get(Number(elo || 0)) as { c: number } | undefined;
  return 1 + Number(row?.c || 0);
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const idParam = String(searchParams.get("id") || "").trim();
  const targetUserId = idParam || session.id;

  const db = getDb();
  const u = db.prepare("SELECT id FROM users WHERE id=?").get(targetUserId);
  if (!u) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const arena = getArenaProfile(targetUserId, 0);
  const profile = arena?.profile || null;

  const room = db
    .prepare("SELECT user_id, background_url, avatar_url, bio, created_at, updated_at FROM arena_rooms WHERE user_id=?")
    .get(targetUserId) as any;

  if (!room) {
    const now = Date.now();
    db.prepare(
      "INSERT INTO arena_rooms (user_id, background_url, avatar_url, bio, created_at, updated_at) VALUES (?, NULL, NULL, NULL, ?, ?)"
    ).run(targetUserId, now, now);
  }

  const room2 = db
    .prepare("SELECT user_id, background_url, avatar_url, bio, created_at, updated_at FROM arena_rooms WHERE user_id=?")
    .get(targetUserId) as any;

  const place = profile ? computePlace(db, Number(profile.elo || 0)) : null;

  const fallbackAvatar =
    (db.prepare("SELECT avatar_url FROM profiles WHERE user_id=?").get(targetUserId) as any)?.avatar_url ?? null;

  return NextResponse.json({
    ok: true,
    meId: session.id,
    profile: profile ? { ...profile, place } : null,
    room: {
      userId: room2.user_id,
      backgroundUrl: room2.background_url ?? null,
      avatarUrl: room2.avatar_url ?? fallbackAvatar,
      bio: room2.bio ?? null,
      createdAt: Number(room2.created_at || 0),
      updatedAt: Number(room2.updated_at || 0),
    },
  });
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const backgroundUrl = String(body?.backgroundUrl || "").trim() || null;
  const avatarUrl = String(body?.avatarUrl || "").trim() || null;
  const bio = String(body?.bio || "").trim() || null;

  const db = getDb();
  const now = Date.now();

  const exists = db.prepare("SELECT user_id FROM arena_rooms WHERE user_id=?").get(session.id) as any;

  if (!exists) {
    db.prepare(
      "INSERT INTO arena_rooms (user_id, background_url, avatar_url, bio, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(session.id, backgroundUrl, avatarUrl, bio, now, now);
  } else {
    db.prepare(
      "UPDATE arena_rooms SET background_url=?, avatar_url=?, bio=?, updated_at=? WHERE user_id=?"
    ).run(backgroundUrl, avatarUrl, bio, now, session.id);
  }

  // Feed event
  try {
    db.prepare(
      "INSERT INTO arena_feed_events (id, kind, actor_user_id, target_user_id, ref_id, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(uuid(), "room_update", session.id, null, null, JSON.stringify({ backgroundUrl, avatarUrl, bio }), now);
  } catch {}

  return NextResponse.json({ ok: true });
}