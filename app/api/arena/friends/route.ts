import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { upsertFriendRequest } from "@/lib/arenaSocial";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const db = getDb();

  const accepted = db
    .prepare(
      `
      SELECT f.friend_id as userId, p.nickname as nickname, f.updated_at as updatedAt
      FROM arena_friends f
      LEFT JOIN profiles p ON p.user_id = f.friend_id
      WHERE f.user_id = ? AND f.status = 'accepted'
      ORDER BY f.updated_at DESC
      `
    )
    .all(session.id);

  const incoming = db
    .prepare(
      `
      SELECT f.user_id as userId, p.nickname as nickname, f.created_at as createdAt
      FROM arena_friends f
      LEFT JOIN profiles p ON p.user_id = f.user_id
      WHERE f.friend_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
      `
    )
    .all(session.id);

  const outgoing = db
    .prepare(
      `
      SELECT f.friend_id as userId, p.nickname as nickname, f.created_at as createdAt
      FROM arena_friends f
      LEFT JOIN profiles p ON p.user_id = f.friend_id
      WHERE f.user_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
      `
    )
    .all(session.id);

  return NextResponse.json({ ok: true, accepted, incoming, outgoing });
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetUserId = String(body?.targetUserId || "").trim();
  if (!targetUserId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const db = getDb();
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(targetUserId);
  if (!target) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const res = upsertFriendRequest(db, session.id, targetUserId);
  if (!res.ok) return NextResponse.json(res, { status: 400 });

  return NextResponse.json({ ok: true, status: res.status });
}
