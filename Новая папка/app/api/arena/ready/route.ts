import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { setMatchReady } from "@/lib/arena";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const matchId = String(body?.matchId || "");
  const ready = Boolean(body?.ready);
  if (!matchId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const r = setMatchReady(matchId, user.id, ready);
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json(r);
}
