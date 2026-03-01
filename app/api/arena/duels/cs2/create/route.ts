import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createCs2Duel } from "@/lib/arenaDuels";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const teamSize = Number(body?.teamSize || 1);
  const map = typeof body?.map === "string" ? body.map : undefined;

const r = createCs2Duel({ userId: user.id, stake: 0, currency: "EUR", teamSize, map }); // ✅ stake всегда 0
  if (!r.ok) return NextResponse.json(r, { status: 400 });

  return NextResponse.json(r);
}