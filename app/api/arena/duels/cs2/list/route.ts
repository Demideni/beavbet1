import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listCs2Duels } from "@/lib/arenaDuels";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const data = listCs2Duels(user.id);
  return NextResponse.json({ ok: true, ...data });
}
