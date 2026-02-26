import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const db = getDb();

  const rows = db
    .prepare(
      `
      SELECT
        t.id as threadId,
        CASE WHEN t.user1_id = ? THEN t.user2_id ELSE t.user1_id END as otherUserId,
        p.nickname as otherNick,
        p.avatar_url as otherAvatar,
        t.updated_at as updatedAt,
        (
          SELECT message FROM arena_dm_messages m
          WHERE m.thread_id = t.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as lastMessage,
        (
          SELECT COUNT(1)
          FROM arena_dm_messages m
          LEFT JOIN arena_dm_reads r ON r.thread_id = t.id AND r.user_id = ?
          WHERE m.thread_id = t.id
            AND m.sender_id != ?
            AND m.created_at > COALESCE(r.last_read_at, 0)
        ) as unreadCount
      FROM arena_dm_threads t
      LEFT JOIN profiles p ON p.user_id = (CASE WHEN t.user1_id = ? THEN t.user2_id ELSE t.user1_id END)
      WHERE t.user1_id = ? OR t.user2_id = ?
      ORDER BY t.updated_at DESC
      LIMIT 100

      `
    )
    .all(session.id, session.id, session.id, session.id, session.id, session.id, session.id);

  return NextResponse.json({ ok: true, threads: rows });
}
