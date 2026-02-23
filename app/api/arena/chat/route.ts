import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { broadcastChat } from "@/lib/arenaChatBus";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, user_id, nickname, message, created_at
       FROM arena_chat_messages
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .all()
    .reverse();
  return NextResponse.json({ ok: true, messages: rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message = String(body?.message || "").trim();
  if (!message) return NextResponse.json({ ok: false, error: "EMPTY" }, { status: 400 });
  if (message.length > 280) return NextResponse.json({ ok: false, error: "TOO_LONG" }, { status: 400 });

  const db = getDb();
  const nickRow = db.prepare("SELECT nickname FROM profiles WHERE user_id=?").get(user.id) as
    | { nickname?: string }
    | undefined;
  const nickname = (nickRow?.nickname || "Player").slice(0, 24);

  const msg = {
    id: randomUUID(),
    user_id: user.id,
    nickname,
    message,
    created_at: Date.now(),
  };

  db.prepare(
    "INSERT INTO arena_chat_messages (id, user_id, nickname, message, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(msg.id, msg.user_id, msg.nickname, msg.message, msg.created_at);

  // opportunistic trim
  db.prepare(
    `DELETE FROM arena_chat_messages
     WHERE id IN (
       SELECT id FROM arena_chat_messages
       ORDER BY created_at DESC
       LIMIT -1 OFFSET 500
     )`
  ).run();

  broadcastChat(msg);
  return NextResponse.json({ ok: true });
}
