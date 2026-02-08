import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { placeBet } from "@/lib/robinson";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bet = Number(body.bet);

  try {
    const out = placeBet(user.id, bet, "USD");
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 400 });
  }
}
