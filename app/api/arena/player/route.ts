import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getArenaProfile } from "@/lib/arenaDuels";

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = String(searchParams.get("id") || "").trim();
  if (!userId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const db = getDb();
  const u = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!u) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const data = getArenaProfile(userId, 10);

  const rel = db
    .prepare(`SELECT status FROM arena_friends WHERE user_id = ? AND friend_id = ?`)
    .get(session.id, userId) as { status?: string } | undefined;

  const incoming = db
    .prepare(`SELECT status FROM arena_friends WHERE user_id = ? AND friend_id = ?`)
    .get(userId, session.id) as { status?: string } | undefined;

  let friendStatus: "none" | "pending_outgoing" | "pending_incoming" | "accepted" = "none";
  if (rel?.status === "accepted") friendStatus = "accepted";
  else if (rel?.status === "pending") friendStatus = "pending_outgoing";
  else if (incoming?.status === "pending") friendStatus = "pending_incoming";

  const follow = db
    .prepare("SELECT 1 AS ok FROM arena_follows WHERE follower_id=? AND followee_id=?")
    .get(session.id, userId) as { ok?: number } | undefined;

  const followStatus: "following" | "not_following" = follow?.ok ? "following" : "not_following";

  return NextResponse.json({ ok: true, profile: data.profile, friendStatus, followStatus });
}