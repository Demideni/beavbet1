import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { setDuelReady } from "@/lib/arenaDuels";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const duelId = String(body?.duelId || "");

  if (!duelId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const r = setDuelReady(duelId, user.id);
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json({ ok: true });
}
