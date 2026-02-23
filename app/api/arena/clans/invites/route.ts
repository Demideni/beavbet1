import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "").toLowerCase();
  const db = getDb();

  if (action === "invite") {
    const clanId = String(body?.clanId || "").trim();
    const userId = String(body?.userId || "").trim();
    if (!clanId || !userId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

    const me = db
      .prepare("SELECT role FROM arena_clan_members WHERE clan_id = ? AND user_id = ?")
      .get(clanId, session.id) as { role?: string } | undefined;
    if (!me) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    if (me.role !== "owner" && me.role !== "admin") return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const exists = db.prepare("SELECT 1 FROM arena_clan_members WHERE clan_id = ? AND user_id = ?").get(clanId, userId);
    if (exists) return NextResponse.json({ ok: false, error: "ALREADY_MEMBER" }, { status: 400 });

    const id = randomUUID();
    const now = Date.now();
    try {
      db.prepare(
        "INSERT INTO arena_clan_invites (id, clan_id, invited_user_id, invited_by_user_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)"
      ).run(id, clanId, userId, session.id, now, now);
    } catch {
      return NextResponse.json({ ok: false, error: "ALREADY_INVITED" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "accept" || action === "decline") {
    const inviteId = String(body?.inviteId || "").trim();
    if (!inviteId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

    const inv = db
      .prepare(
        "SELECT id, clan_id as clanId, invited_user_id as invitedUserId, status FROM arena_clan_invites WHERE id = ?"
      )
      .get(inviteId) as { clanId: string; invitedUserId: string; status: string } | undefined;

    if (!inv || inv.invitedUserId !== session.id) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (inv.status !== "pending") return NextResponse.json({ ok: false, error: "NOT_PENDING" }, { status: 400 });

    const already = db.prepare("SELECT 1 FROM arena_clan_members WHERE user_id = ? LIMIT 1").get(session.id);
    if (already) return NextResponse.json({ ok: false, error: "ALREADY_IN_CLAN" }, { status: 400 });

    const now = Date.now();
    if (action === "decline") {
      db.prepare("UPDATE arena_clan_invites SET status = 'declined', updated_at = ? WHERE id = ?").run(now, inviteId);
      return NextResponse.json({ ok: true });
    }

    db.prepare("UPDATE arena_clan_invites SET status = 'accepted', updated_at = ? WHERE id = ?").run(now, inviteId);
    db.prepare("INSERT INTO arena_clan_members (clan_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)")
      .run(inv.clanId, session.id, now);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "BAD_ACTION" }, { status: 400 });
}
