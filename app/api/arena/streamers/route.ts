import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { STREAMERS, PARTNERS } from "@/lib/streamers";

type DbRow = {
  id: string;
  type: string;
  slug: string;
  name: string;
  title: string;
  photo: string;
  tagline: string | null;
  socials_json: string | null;
  kick_channel: string | null;
  kick_embed_url: string | null;
  active: number;
};

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

  // Load admin-managed streamers from DB
  const dbRows = db
    .prepare(
      `SELECT id, type, slug, name, title, photo, tagline, socials_json, kick_channel, kick_embed_url, active
       FROM arena_streamers
       WHERE active = 1
       ORDER BY updated_at DESC`
    )
    .all() as DbRow[];

  const fromDb = dbRows.map((r) => {
    let socials: any = {};
    try {
      socials = r.socials_json ? JSON.parse(r.socials_json) : {};
    } catch {
      socials = {};
    }
    return {
      slug: r.slug,
      name: r.name,
      title: r.title,
      photo: r.photo,
      socials,
      kickChannel: r.kick_channel || undefined,
      kickEmbedUrl: r.kick_embed_url || undefined,
      tagline: r.tagline || undefined,
      _source: "db",
      _id: r.id,
      _type: r.type,
    };
  });

  const enrich = (arr: any[]) =>
    arr.map((s) => ({
      ...s,
      teamCount: countMap.get(s.slug) || 0,
      joined: my.includes(s.slug),
    }));

  // Merge: STATIC first, then DB (but avoid slug duplicates)
  const seen = new Set<string>();
  const pushUnique = (out: any[], list: any[]) => {
    for (const x of list) {
      const slug = String(x.slug || "").toLowerCase();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push(x);
    }
  };

  const streamersCombined: any[] = [];
  const partnersCombined: any[] = [];

  // Static
  pushUnique(streamersCombined, STREAMERS.map((x) => ({ ...x, _source: "static", _type: "streamer" })));
  pushUnique(partnersCombined, PARTNERS.map((x) => ({ ...x, _source: "static", _type: "partner" })));

  // DB
  pushUnique(streamersCombined, fromDb.filter((x: any) => x._type === "streamer"));
  pushUnique(partnersCombined, fromDb.filter((x: any) => x._type === "partner"));

  return NextResponse.json({
    ok: true,
    streamers: enrich(streamersCombined),
    partners: enrich(partnersCombined),
  });
}

// Join team
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const slug = String(body?.slug || "").trim().toLowerCase();
  if (!slug) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const db = getDb();

  // Validate slug exists either in static or DB
  const allStatic = [...STREAMERS, ...PARTNERS].some((s) => s.slug === slug);
  const dbExists = Boolean(
    db.prepare(`SELECT 1 FROM arena_streamers WHERE slug=? AND active=1`).get(slug)
  );

  if (!allStatic && !dbExists) {
    return NextResponse.json({ ok: false, error: "UNKNOWN_STREAMER" }, { status: 404 });
  }

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

// Leave team
export async function DELETE(req: Request) {
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