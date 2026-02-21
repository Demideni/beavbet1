import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getCs2DuelView } from "@/lib/arenaDuels";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const duelId = req.nextUrl.searchParams.get("id");
  if (!duelId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const data = getCs2DuelView(user.id, duelId);
  if (!data.ok) return NextResponse.json(data, { status: 404 });
  return NextResponse.json(data);
}
