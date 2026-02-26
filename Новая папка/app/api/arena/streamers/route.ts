import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { STREAMERS, PARTNERS } from "@/lib/streamers";

export async function GET() {
  const db = getDb();
  const user = await getSessionUser().catch(() => null);

  const counts = db
    .prepare(
      `SELECT streamer_slug as slug, COUNT(*) as c
       FROM streamer_team_members
       GROUP BY streamer_slug`
    )
    .all() as Array<{ slug: string; c: number }>;

  const countMap = new Map(counts.map((r) => [r.slug, Number(r.c || 0)]));

  let my: string[] = [];
  if (user) {
    const rows = db
      .prepare(`SELECT streamer_slug FROM streamer_team_members WHERE user_id=?`)
      .all(user.id) as Array<{ streamer_slug: string }>;
    my = rows.map((r) => r.streamer_slug);
  }

  const enrich = (arr: any[]) =>
    arr.map((s) => ({
      ...s,
      teamCount: countMap.get(s.slug) || 0,
      joined: my.includes(s.slug),
    }));

  return NextResponse.json({
    ok: true,
    streamers: enrich(STREAMERS),
    partners: enrich(PARTNERS),
  });
}

export async function POST(req: Request) {
  // Join team
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const slug = String(body?.slug || "").trim().toLowerCase();
  if (!slug) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const all = [...STREAMERS, ...PARTNERS];
  if (!all.some((s) => s.slug === slug)) {
    return NextResponse.json({ ok: false, error: "UNKNOWN_STREAMER" }, { status: 404 });
  }

  const db = getDb();
  const id = randomUUID();
  try {
    db.prepare(
      `INSERT INTO streamer_team_members (id, streamer_slug, user_id, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(id, slug, user.id, Date.now());
  } catch {
    // already joined
  }

  const c = db
    .prepare(`SELECT COUNT(*) as c FROM streamer_team_members WHERE streamer_slug=?`)
    .get(slug) as { c?: number } | undefined;

  return NextResponse.json({ ok: true, slug, teamCount: Number(c?.c || 0) });
}

export async function DELETE(req: Request) {
  // Leave team
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const slug = String(url.searchParams.get("slug") || "").trim().toLowerCase();
  if (!slug) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const db = getDb();
  db.prepare(`DELETE FROM streamer_team_members WHERE user_id=? AND streamer_slug=?`).run(user.id, slug);

  const c = db
    .prepare(`SELECT COUNT(*) as c FROM streamer_team_members WHERE streamer_slug=?`)
    .get(slug) as { c?: number } | undefined;

  return NextResponse.json({ ok: true, slug, teamCount: Number(c?.c || 0) });
}
