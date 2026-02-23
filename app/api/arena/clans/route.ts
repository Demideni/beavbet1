import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const db = getDb();

  const my = db
    .prepare(
      `
      SELECT c.id, c.name, c.tag, c.owner_id as ownerId, c.avatar_url as avatarUrl, c.created_at as createdAt,
             m.role as myRole
      FROM arena_clan_members m
      JOIN arena_clans c ON c.id = m.clan_id
      WHERE m.user_id = ?
      LIMIT 1
      `
    )
    .get(session.id);

  const invites = db
    .prepare(
      `
      SELECT i.id, i.clan_id as clanId, c.name as clanName, c.tag as clanTag,
             i.invited_by_user_id as invitedByUserId,
             p.nickname as invitedByNick,
             i.status, i.created_at as createdAt
      FROM arena_clan_invites i
      JOIN arena_clans c ON c.id = i.clan_id
      LEFT JOIN profiles p ON p.user_id = i.invited_by_user_id
      WHERE i.invited_user_id = ? AND i.status = 'pending'
      ORDER BY i.created_at DESC
      LIMIT 20
      `
    )
    .all(session.id);

  return NextResponse.json({ ok: true, myClan: my ?? null, invites });
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const tag = String(body?.tag || "").trim();
  const avatarUrl = String(body?.avatarUrl || "").trim();
  if (!name || name.length < 3) return NextResponse.json({ ok: false, error: "BAD_NAME" }, { status: 400 });
  if (name.length > 32) return NextResponse.json({ ok: false, error: "NAME_TOO_LONG" }, { status: 400 });
  if (tag && (tag.length < 2 || tag.length > 6)) return NextResponse.json({ ok: false, error: "BAD_TAG" }, { status: 400 });

  const db = getDb();
  const already = db.prepare("SELECT 1 FROM arena_clan_members WHERE user_id = ? LIMIT 1").get(session.id);
  if (already) return NextResponse.json({ ok: false, error: "ALREADY_IN_CLAN" }, { status: 400 });

  const id = randomUUID();
  const now = Date.now();
  try {
    db.prepare(
      "INSERT INTO arena_clans (id, name, tag, owner_id, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, name, tag || null, session.id, avatarUrl || null, now);
  } catch {
    return NextResponse.json({ ok: false, error: "NAME_TAKEN" }, { status: 409 });
  }
  db.prepare("INSERT INTO arena_clan_members (clan_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)")
    .run(id, session.id, now);

  return NextResponse.json({ ok: true, clanId: id });
}
