import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { reportDuelResult } from "@/lib/arenaDuels";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const duelId = String(body?.duelId || "");
  const result = String(body?.result || "");
  if (!duelId || (result !== "win" && result !== "lose")) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const r = reportDuelResult(duelId, user.id, result as any);
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json(r);
}
