import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getOrCreateActiveTournaments, getLeaderboard, getMyEntry } from "@/lib/tournaments";

export async function GET() {
  const user = await getSessionUser();
  const { daily, monthly } = getOrCreateActiveTournaments("robinson");

  const dailyLb = getLeaderboard(daily.id, 50);
  const monthlyLb = getLeaderboard(monthly.id, 50);

  return NextResponse.json({
    tournaments: [
      {
        ...daily,
        leaderboard: dailyLb,
        me: user ? getMyEntry(daily.id, user.id) : null,
      },
      {
        ...monthly,
        leaderboard: monthlyLb,
        me: user ? getMyEntry(monthly.id, user.id) : null,
      },
    ],
  });
}
