import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isAdminUser } from "@/lib/admin";

function normSlug(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (!isAdminUser(session.id, session.email)) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  const type = String(body?.type || "streamer").trim().toLowerCase();
  if (type !== "streamer" && type !== "partner") {
    return NextResponse.json({ ok: false, error: "BAD_TYPE" }, { status: 400 });
  }

  const slug = normSlug(body?.slug || body?.name || "");
  const name = String(body?.name || "").trim();
  const title = String(body?.title || "").trim();
  const photo = String(body?.photo || "").trim();

  const tagline = body?.tagline ? String(body.tagline).trim() : "";
  const kickChannel = body?.kickChannel ? String(body.kickChannel).trim() : "";
  const kickEmbedUrl = body?.kickEmbedUrl ? String(body.kickEmbedUrl).trim() : "";

  const socials = body?.socials && typeof body.socials === "object" ? body.socials : {};
  const socialsJson = JSON.stringify(socials || {});

  if (!slug || !name || !title || !photo) {
    return NextResponse.json({ ok: false, error: "VALIDATION" }, { status: 400 });
  }

  const db = getDb();

  // Upsert by slug
  const exists = db.prepare(`SELECT id FROM arena_streamers WHERE slug=?`).get(slug) as { id?: string } | undefined;
  const now = Date.now();

  if (exists?.id) {
    db.prepare(
      `UPDATE arena_streamers
       SET type=?, name=?, title=?, photo=?, tagline=?, socials_json=?, kick_channel=?, kick_embed_url=?, active=1, updated_at=?
       WHERE slug=?`
    ).run(type, name, title, photo, tagline || null, socialsJson, kickChannel || null, kickEmbedUrl || null, now, slug);

    return NextResponse.json({ ok: true, slug, updated: true });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO arena_streamers(id, type, slug, name, title, photo, tagline, socials_json, kick_channel, kick_embed_url, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(id, type, slug, name, title, photo, tagline || null, socialsJson, kickChannel || null, kickEmbedUrl || null, now, now);

  return NextResponse.json({ ok: true, slug, created: true });
}

export async function DELETE(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (!isAdminUser(session.id, session.email)) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const slug = normSlug(searchParams.get("slug") || "");
  if (!slug) return NextResponse.json({ ok: false, error: "NO_SLUG" }, { status: 400 });

  const db = getDb();
  db.prepare(`UPDATE arena_streamers SET active=0, updated_at=? WHERE slug=?`).run(Date.now(), slug);

  return NextResponse.json({ ok: true });
}