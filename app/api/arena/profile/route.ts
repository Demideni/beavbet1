import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getArenaProfile } from "@/lib/arenaDuels";
import { getDb, uuid } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const data = getArenaProfile(user.id, 30);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : null;
  const avatarUrl = typeof body?.avatarUrl === "string" ? body.avatarUrl.trim() : null;

  if (nickname && nickname.length > 24) return NextResponse.json({ ok: false, error: "NICK_TOO_LONG" }, { status: 400 });
  if (avatarUrl && avatarUrl.length > 500) return NextResponse.json({ ok: false, error: "AVATAR_TOO_LONG" }, { status: 400 });

  const db = getDb();
  const now = Date.now();

  const exists = db.prepare("SELECT user_id FROM profiles WHERE user_id = ?").get(user.id);
  if (!exists) {
    db.prepare("INSERT INTO profiles (user_id, nickname, currency, created_at) VALUES (?, ?, 'EUR', ?)").run(
      user.id,
      nickname || null,
      now
    );
  }

  db.prepare("UPDATE profiles SET nickname = ?, avatar_url = ? WHERE user_id = ?").run(
    nickname || null,
    avatarUrl || null,
    user.id
  );

  // Feed event
  try {
    db.prepare(
      "INSERT INTO arena_feed_events (id, kind, actor_user_id, target_user_id, ref_id, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      uuid(),
      "profile_update",
      user.id,
      null,
      null,
      JSON.stringify({ nickname: nickname || null, avatarUrl: avatarUrl || null }),
      now
    );
  } catch {}

  return NextResponse.json({ ok: true });
}