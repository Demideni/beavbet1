import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listTournaments } from "@/lib/arena";

export const runtime = "nodejs";

function ratingNameFromElo(elo: number) {
  if (elo >= 2000) return "Elite";
  if (elo >= 1700) return "Diamond";
  if (elo >= 1400) return "Gold";
  if (elo >= 1000) return "Silver";
  return "Bronze";
}

export async function GET() {
  const db = getDb();
  const user = await getSessionUser();

  // Open duels (quick 1v1)
  const openDuels = db
    .prepare(
      `SELECT d.id, d.stake, d.currency, d.status, d.map, d.updated_at,
              p1.nickname as p1_nick,
              p2.nickname as p2_nick
       FROM arena_duels d
       LEFT JOIN profiles p1 ON p1.user_id = d.p1_user_id
       LEFT JOIN profiles p2 ON p2.user_id = d.p2_user_id
       WHERE d.status IN ('open','active')
       ORDER BY d.updated_at DESC
       LIMIT 25`
    )
    .all();

  const myDuels = user
    ? db
        .prepare(
          `SELECT d.id, d.stake, d.currency, d.status, d.map, d.updated_at,
                  p1.nickname as p1_nick,
                  p2.nickname as p2_nick
           FROM arena_duels d
           LEFT JOIN profiles p1 ON p1.user_id = d.p1_user_id
           LEFT JOIN profiles p2 ON p2.user_id = d.p2_user_id
           WHERE (d.p1_user_id = ? OR d.p2_user_id = ?)
           ORDER BY d.updated_at DESC
           LIMIT 25`
        )
        .all(user.id, user.id)
    : [];

  // Tournaments (seeded automatically)
  const tournaments = listTournaments().map((t) => ({
    id: t.id,
    game: t.game,
    title: t.title,
    entryFee: t.entry_fee,
    currency: t.currency,
    players: (t as any).players ?? 0,
    maxPlayers: t.max_players,
    status: t.status === "finished" ? "done" : t.status,
  }));

  // Activity (optional)
  const activity = db
    .prepare(
      `SELECT d.id,
              CASE
                WHEN d.status='done' THEN 'duel_done'
                WHEN d.status='active' THEN 'duel_active'
                ELSE 'duel_open'
              END as kind,
              COALESCE(d.ended_at, d.updated_at) as at,
              d.stake,
              d.currency,
              w.nickname as winner_nick
       FROM arena_duels d
       LEFT JOIN profiles w ON w.user_id = d.winner_user_id
       ORDER BY COALESCE(d.ended_at, d.updated_at) DESC
       LIMIT 12`
    )
    .all();

  // My rating (optional)
  let myRating = 1000;
  let ratingName = "Silver";
  if (user) {
    const r = db
      .prepare("SELECT dam_rank as elo FROM arena_ratings WHERE user_id = ?")
      .get(user.id) as { elo: number } | undefined;
    if (typeof r?.elo === "number") {
      myRating = Number(r.elo);
      ratingName = ratingNameFromElo(myRating);
    }
  }

  // Arena king (top 1)
  const top = db
    .prepare("SELECT user_id, dam_rank as elo FROM arena_ratings ORDER BY dam_rank DESC LIMIT 1")
    .get() as { user_id: string; elo: number } | undefined;

  return NextResponse.json({
    ok: true,
    openDuels,
    myDuels,
    tournaments,
    activity,
    myRating,
    ratingName,
    kingUserId: top?.user_id ?? null,
    kingElo: typeof top?.elo === "number" ? Number(top.elo) : null,
  });
}
