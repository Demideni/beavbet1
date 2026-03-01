import { NextRequest, NextResponse } from "next/server";
import { joinCs2Duel } from "@/lib/arena/duels/cs2";

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

    const result = joinCs2Duel({ duelId, userId });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("JOIN_DUEL_ERROR:", error);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}