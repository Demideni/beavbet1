import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getArenaActivity } from "@/lib/arenaDuels";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const data = getArenaActivity(25);
  return NextResponse.json(data);
}
