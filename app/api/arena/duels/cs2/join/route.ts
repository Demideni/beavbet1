import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { joinCs2Duel } from "@/lib/arenaDuels";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const duelId = String(body?.duelId || "");
  const team = body?.team != null ? Number(body.team) : undefined;
  if (!duelId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const r = joinCs2Duel(user.id, duelId, team);
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json(r);
}
