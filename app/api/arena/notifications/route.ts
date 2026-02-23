import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const db = getDb();
  const incoming = db
    .prepare("SELECT COUNT(1) as c FROM arena_friends WHERE friend_id = ? AND status = 'pending'")
    .get(session.id) as { c: number };

  const unreadDm = db
    .prepare(
      `
      SELECT COUNT(1) as c
      FROM arena_dm_threads t
      JOIN arena_dm_messages m ON m.thread_id = t.id
      LEFT JOIN arena_dm_reads r ON r.thread_id = t.id AND r.user_id = ?
      WHERE (t.user1_id = ? OR t.user2_id = ?)
        AND m.sender_id != ?
        AND m.created_at > COALESCE(r.last_read_at, 0)
      `
    )
    .get(session.id, session.id, session.id, session.id) as { c: number };

  return NextResponse.json({ ok: true, incomingFriends: incoming?.c ?? 0, unreadDm: unreadDm?.c ?? 0 });
}
