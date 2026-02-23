import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { broadcastDm } from "@/lib/arenaDmBus";
import { publishToUser } from "@/lib/arenaNotify";

function canAccessThread(db: any, userId: string, threadId: string) {
  const t = db
    .prepare("SELECT user1_id, user2_id FROM arena_dm_threads WHERE id = ?")
    .get(threadId) as { user1_id: string; user2_id: string } | undefined;
  if (!t) return false;
  return t.user1_id === userId || t.user2_id === userId;
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const threadId = String(searchParams.get("threadId") || "").trim();
  const limit = Math.min(200, Math.max(10, Number(searchParams.get("limit") || 50)));
  if (!threadId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const db = getDb();
  if (!canAccessThread(db, session.id, threadId)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  
const rows = (db
  .prepare(
    `
    SELECT m.id, m.thread_id as threadId, m.sender_id as senderId, m.message, m.created_at as createdAt,
           p.nickname as senderNick
    FROM arena_dm_messages m
    LEFT JOIN profiles p ON p.user_id = m.sender_id
    WHERE m.thread_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
    `
  )
  .all(threadId, limit) as any[]).reverse(); // oldest -> newest

  // Mark as read
  const now = Date.now();
  db.prepare(
    "INSERT OR REPLACE INTO arena_dm_reads (thread_id, user_id, last_read_at) VALUES (?, ?, ?)"
  ).run(threadId, session.id, now);

  return NextResponse.json({ ok: true, messages: rows });

}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const threadId = String(body?.threadId || "").trim();
  const message = String(body?.message || "").trim();
  if (!threadId || !message) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  if (message.length > 500) return NextResponse.json({ ok: false, error: "TOO_LONG" }, { status: 400 });

  const db = getDb();
  if (!canAccessThread(db, session.id, threadId)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    "INSERT INTO arena_dm_messages (id, thread_id, sender_id, message, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, threadId, session.id, message, now);
  db.prepare("UPDATE arena_dm_threads SET updated_at = ? WHERE id = ?").run(now, threadId);
  // Sender has read their own message
  db.prepare("INSERT OR REPLACE INTO arena_dm_reads (thread_id, user_id, last_read_at) VALUES (?, ?, ?)").run(threadId, session.id, now);

  const senderNick = (
    db.prepare("SELECT nickname FROM profiles WHERE user_id = ?").get(session.id) as { nickname?: string } | undefined
  )?.nickname ?? null;

  const payload = { id, thread_id: threadId, sender_id: session.id, sender_nick: senderNick, message, created_at: now };
  broadcastDm(payload);

  const t = db.prepare("SELECT user1_id, user2_id FROM arena_dm_threads WHERE id = ?").get(threadId) as { user1_id: string; user2_id: string } | undefined;
  const otherId = t ? (t.user1_id === session.id ? t.user2_id : t.user1_id) : null;
  if (otherId) {
    publishToUser(otherId, {
      type: "dm_message",
      fromUserId: session.id,
      fromNick: senderNick,
      threadId,
      createdAt: now,
      preview: message.slice(0, 80),
    });
  }

  return NextResponse.json({ ok: true, message: payload });
}
