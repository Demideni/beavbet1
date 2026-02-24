import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { broadcastChat } from "@/lib/arenaChatBus";

const BOT_USER_ID = "arena_bot";
const BOT_NICK = "ArenaBot";

function rand<T>(arr: readonly T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeBotMessage() {
  const stakes = [5, 10, 20, 50, 100, 250, 500] as const;
  const maps = ["de_mirage", "de_inferno", "de_ancient", "de_nuke", "de_anubis", "de_overpass", "de_vertigo"] as const;
  const clans = ["ZOTIX", "BeavBet", "NightRaid", "Raccoon", "SIBERIA", "OrangeSquad", "Vikings"] as const;
  const roles = ["AWP", "entry", "support", "IGL", "rifler"] as const;

  const templates = [
    () => `Ищу соперника на ${rand(stakes)}€ • 1v1 • ${rand(maps)}. Кто готов — залетай 🔥`,
    () => `Набор в клан ${rand(clans)}: ищем ${rand(roles)}. Дисциплина + праки. Пиши в ЛС 👀`,
    () => `Ищу клан: ${rand(roles)}, онлайн по вечерам, хочу играть праки и турниры.`,
    () => `Кто на дуэль? Ставка ${rand(stakes)}€, быстрый ready-check, без токсика 😄`,
    () => `Турнирный стак ищет 2х игроков (2v2/5v5 микс). Главное — коммуникация.`,
    () => `Нужен спарринг на ${rand(maps)}. Разогрев перед праками.`,
    () => `Ищу тиммейта для 2v2, ставка ${rand(stakes)}€, играем аккуратно, без раша в смок 😅`,
  ] as const;

  const message = rand(templates)();
  return {
    id: randomUUID(),
    user_id: BOT_USER_ID,
    nickname: BOT_NICK,
    message,
    created_at: Date.now(),
  };
}

function maybePostBot(db: any) {
  // Add light "ambient" chat activity, but never spam.
  // Runs opportunistically on GET requests.
  const now = Date.now();
  const last = db
    .prepare(
      `SELECT created_at FROM arena_chat_messages
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(BOT_USER_ID) as { created_at?: number } | undefined;

  const lastAt = Number(last?.created_at || 0);
  const silenceMs = now - lastAt;
  if (silenceMs < 90_000) return; // at most ~1 bot msg per 90s

  // ~55% chance to post when silent enough
  if (Math.random() > 0.55) return;

  const msg = makeBotMessage();
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
}

export async function GET() {
  const db = getDb();

  // Opportunistically add non-primitive bot messages to make the chat feel alive in beta.
  // NOTE: These are clearly labeled as ArenaBot.
  try {
    maybePostBot(db);
  } catch {
    // ignore bot failures
  }

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
