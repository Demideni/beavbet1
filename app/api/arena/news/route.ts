import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isAdminUser } from "@/lib/admin";

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 12)));

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT n.id, n.title, n.text, n.image_url, n.created_at,
              p.nickname AS admin_nick, p.avatar_url AS admin_avatar
       FROM arena_news_posts n
       LEFT JOIN profiles p ON p.user_id = n.admin_user_id
       ORDER BY n.created_at DESC
       LIMIT ?`
    )
    .all(limit) as any[];

  return NextResponse.json({
    ok: true,
    items: rows.map((r) => ({
      id: String(r.id),
      title: String(r.title || ""),
      text: String(r.text || ""),
      imageUrl: r.image_url ? String(r.image_url) : null,
      createdAt: Number(r.created_at || 0),
      adminNick: r.admin_nick ?? null,
      adminAvatarUrl: r.admin_avatar ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (!isAdminUser(session.id, session.email)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const title = String(body?.title || "").trim();
  const text = String(body?.text || "").trim();
  const imageUrl = body?.imageUrl ? String(body.imageUrl).trim() : "";

  if (!title || !text) {
    return NextResponse.json({ ok: false, error: "VALIDATION" }, { status: 400 });
  }

  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO arena_news_posts(id, admin_user_id, title, text, image_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, session.id, title, text, imageUrl || null, Date.now());

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (!isAdminUser(session.id, session.email)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "NO_ID" }, { status: 400 });

  const db = getDb();
  db.prepare("DELETE FROM arena_news_posts WHERE id = ?").run(id);

  return NextResponse.json({ ok: true });
}