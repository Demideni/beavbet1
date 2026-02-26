import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 20)));

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, currency, sport_key, league_title, event_id, commence_time,
              home_team, away_team, market_key, outcome_name, odds, stake,
              potential_payout, status, created_at, meta
         FROM bets
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?`
    )
    .all(user.id, limit) as any[];

  const data = rows.map((r) => ({
    ...r,
    meta: r.meta ? safeParse(r.meta) : null,
  }));

  return NextResponse.json({ data });
}

function safeParse(v: string) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}
