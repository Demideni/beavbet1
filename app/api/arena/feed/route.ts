import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

type FeedItem =
  | {
      type: "post";
      id: string;
      createdAt: number;
      actorUserId: string;
      actorNick: string | null;
      actorAvatarUrl: string | null;
      text: string | null;
      imageUrl: string | null;
    }
  | {
      type: "event";
      id: string;
      createdAt: number;
      kind: string;
      actorUserId: string;
      actorNick: string | null;
      actorAvatarUrl: string | null;
      targetUserId: string | null;
      targetNick: string | null;
      meta: any;
    };

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit") || 40)));

  const db = getDb();

  const followees = db
    .prepare("SELECT followee_id FROM arena_follows WHERE follower_id=?")
    .all(session.id)
    .map((r: any) => String(r.followee_id));

  const scope = Array.from(new Set([session.id, ...followees]));
  const inClause = scope.map(() => "?").join(",");

  const posts = db
    .prepare(
      `SELECT p.id, p.user_id, p.text, p.image_url, p.created_at,
              pr.nickname AS nick, pr.avatar_url AS avatar
       FROM arena_room_posts p
       LEFT JOIN profiles pr ON pr.user_id = p.user_id
       WHERE p.user_id IN (${inClause})
       ORDER BY p.created_at DESC
       LIMIT ?`
    )
    .all(...scope, limit)
    .map(
      (r: any) =>
        ({
          type: "post",
          id: r.id,
          createdAt: Number(r.created_at || 0),
          actorUserId: r.user_id,
          actorNick: r.nick ?? null,
          actorAvatarUrl: r.avatar ?? null,
          text: r.text ?? null,
          imageUrl: r.image_url ?? null,
        } satisfies FeedItem)
    );

  const events = db
    .prepare(
      `SELECT e.id, e.kind, e.actor_user_id, e.target_user_id, e.ref_id, e.meta, e.created_at,
              a.nickname AS actor_nick, a.avatar_url AS actor_avatar,
              t.nickname AS target_nick
       FROM arena_feed_events e
       LEFT JOIN profiles a ON a.user_id = e.actor_user_id
       LEFT JOIN profiles t ON t.user_id = e.target_user_id
       WHERE e.actor_user_id IN (${inClause})
       ORDER BY e.created_at DESC
       LIMIT ?`
    )
    .all(...scope, limit)
    .map((r: any) => {
      let meta: any = null;
      try {
        meta = r.meta ? JSON.parse(String(r.meta)) : null;
      } catch {
        meta = null;
      }
      return {
        type: "event",
        id: r.id,
        createdAt: Number(r.created_at || 0),
        kind: String(r.kind || ""),
        actorUserId: String(r.actor_user_id),
        actorNick: r.actor_nick ?? null,
        actorAvatarUrl: r.actor_avatar ?? null,
        targetUserId: r.target_user_id ? String(r.target_user_id) : null,
        targetNick: r.target_nick ?? null,
        meta,
      } satisfies FeedItem;
    });

  const items = [...posts, ...events]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit);

  return NextResponse.json({ ok: true, items, followingCount: followees.length });
}