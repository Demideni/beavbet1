import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { finishRound } from "@/lib/robinson";
import { getOrCreateActiveTournaments, recordTournamentResult } from "@/lib/tournaments";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const roundId = String(body.roundId || "");
  const multiplier = Number(body.multiplier || 1);
  const result = (body.result === "won" ? "won" : "lost") as "won" | "lost";

  if (!roundId) return NextResponse.json({ error: "roundId required" }, { status: 400 });

  try {
    const out = finishRound(user.id, roundId, multiplier, result);

    // Record tournaments only for a clean WIN landing
    if (out.won) {
      const { daily, monthly } = getOrCreateActiveTournaments("robinson");
      recordTournamentResult({ tournamentId: daily.id, userId: user.id, roundId, multiplier: (out.multiplier ?? 0), won: true });
      recordTournamentResult({ tournamentId: monthly.id, userId: user.id, roundId, multiplier: (out.multiplier ?? 0), won: true });
    } else {
      // still count rounds for both tournaments
      const { daily, monthly } = getOrCreateActiveTournaments("robinson");
      recordTournamentResult({ tournamentId: daily.id, userId: user.id, roundId, multiplier: (out.multiplier ?? 0), won: false });
      recordTournamentResult({ tournamentId: monthly.id, userId: user.id, roundId, multiplier: (out.multiplier ?? 0), won: false });
    }

    return NextResponse.json({ balance: out.balance });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 400 });
  }
}
