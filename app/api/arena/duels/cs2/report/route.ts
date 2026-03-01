import { NextRequest, NextResponse } from "next/server";
import { reportDuelResult } from "@/lib/arena/duels/cs2";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { duelId, userId, result } = body;

    if (!duelId || !userId || !result) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // ✅ новый правильный вызов: один аргумент-объект
    const r = reportDuelResult({ duelId, userId, result });

    if (!r.ok) return NextResponse.json(r, { status: 400 });

    return NextResponse.json(r);
  } catch (error) {
    console.error("DUEL_REPORT_ERROR:", error);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}