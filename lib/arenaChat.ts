import { getDb, uuid } from "@/lib/db";

export type ArenaChatMessage = {
  id: string;
  user_id: string;
  nickname: string | null;
  message: string;
  created_at: number;
};

function getNick(db: any, userId: string) {
  const r = db.prepare("SELECT nickname FROM profiles WHERE user_id=?").get(userId) as
    | { nickname?: string }
    | undefined;
  return (r?.nickname ?? null) as string | null;
}

export function listArenaChatMessages(limit = 50): ArenaChatMessage[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, user_id, nickname, message, created_at
       FROM arena_chat_messages
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as ArenaChatMessage[];
  return rows.reverse();
}

export function listArenaChatMessagesSince(sinceMs: number, limit = 50): ArenaChatMessage[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, user_id, nickname, message, created_at
       FROM arena_chat_messages
       WHERE created_at > ?
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .all(sinceMs, limit) as ArenaChatMessage[];
  return rows;
}

export function addArenaChatMessage(userId: string, messageRaw: string): ArenaChatMessage {
  const db = getDb();
  const message = (messageRaw ?? "").toString().trim();
  if (!message) throw new Error("EMPTY");
  if (message.length > 200) throw new Error("TOO_LONG");

  const id = uuid();
  const created_at = Date.now();
  const nickname = getNick(db, userId);

  db.prepare(
    `INSERT INTO arena_chat_messages (id, user_id, nickname, message, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, userId, nickname, message, created_at);

  return { id, user_id: userId, nickname, message, created_at };
}
