import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listCs2Duels, getArenaActivity } from "@/lib/arenaDuels";
import { listTournaments } from "@/lib/arena";

// Dashboard payload used by /app/arena/ArenaClient.tsx
// Keep it defensive: never throw on partial DB/migration states.

function toIso(ts: any) {
  const n = typeof ts === "number" ? ts : Number(ts);
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString();
  return new Date(n).toISOString();
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  // Duels
  const duelData = listCs2Duels(user.id);
  const duels = (duelData as any)?.duels ?? [];

  const openDuels = Array.isArray(duels)
    ? duels
        .filter((d: any) => d?.status === "open")
        .slice(0, 30)
        .map((d: any) => ({
          id: String(d.id),
          stake: Number(d.stake || 0),
          currency: String(d.currency || "EUR"),
          status: String(d.status || "open"),
          map: d.map ? String(d.map) : undefined,
          p1_nick: d.p1_nick ? String(d.p1_nick) : undefined,
          p2_nick: d.p2_nick ? String(d.p2_nick) : undefined,
          updated_at: toIso(d.updated_at ?? d.created_at ?? Date.now()),
        }))
    : [];

  const myDuels = Array.isArray(duels)
    ? duels
        .filter((d: any) => d && (d.p1_user_id === user.id || d.p2_user_id === user.id))
        .slice(0, 30)
        .map((d: any) => ({
          id: String(d.id),
          stake: Number(d.stake || 0),
          currency: String(d.currency || "EUR"),
          status: String(d.status || "open"),
          map: d.map ? String(d.map) : undefined,
          p1_nick: d.p1_nick ? String(d.p1_nick) : undefined,
          p2_nick: d.p2_nick ? String(d.p2_nick) : undefined,
          updated_at: toIso(d.updated_at ?? d.created_at ?? Date.now()),
        }))
    : [];

  // Tournaments
  const tournaments = listTournaments().map((t: any) => ({
    id: String(t.id),
    game: String(t.game || "cs2"),
    title: String(t.title || "Tournament"),
    entryFee: Number(t.entry_fee || 0),
    currency: String(t.currency || "EUR"),
    players: Number((t as any).players ?? 0),
    maxPlayers: Number(t.max_players || 0),
    status: (t.status as any) || "open",
  }));

  // Activity
  const act = getArenaActivity(25);
  const activity = (act as any)?.items
    ? (act as any).items.map((a: any) => ({
        id: String(a.id),
        kind: a.kind,
        at: toIso(a.at),
        stake: Number(a.stake || 0),
        currency: String(a.currency || "EUR"),
        winner_nick: a.winner_nick ? String(a.winner_nick) : undefined,
      }))
    : [];

  const myRatingObj = (duelData as any)?.myRating;
  const myRating = typeof myRatingObj?.dam_rank === "number" ? myRatingObj.dam_rank : 1000;
  const ratingName = typeof (duelData as any)?.ratingName === "string" ? (duelData as any).ratingName : "Silver";

  return NextResponse.json({
    ok: true,
    openDuels,
    myDuels,
    tournaments,
    activity,
    myRating,
    ratingName,
  });
}
