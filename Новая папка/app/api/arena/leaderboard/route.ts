import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getArenaLeaderboard } from "@/lib/arenaDuels";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const data = getArenaLeaderboard(50);
  return NextResponse.json(data);
}
