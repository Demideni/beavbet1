import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getArenaProfile } from "@/lib/arenaDuels";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const data = getArenaProfile(user.id, 30);
  return NextResponse.json(data);
}
