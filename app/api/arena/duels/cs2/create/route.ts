import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createCs2Duel } from "@/lib/arenaDuels";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const stake = Number(body?.stake);
  const currency = String(body?.currency || "EUR").toUpperCase();

  const r = createCs2Duel(user.id, stake, currency);
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  // refresh wallet chip
  return NextResponse.json(r);
}
