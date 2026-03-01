import { NextRequest, NextResponse } from "next/server";
import { setDuelReady } from "@/lib/arena/duels/cs2";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { duelId, userId } = body;

    if (!duelId || !userId) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // ✅ правильный новый вызов: один аргумент-объект
    const r = setDuelReady({ duelId, userId });

    if (!r.ok) {
      return NextResponse.json(r, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DUEL_READY_ERROR:", error);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}