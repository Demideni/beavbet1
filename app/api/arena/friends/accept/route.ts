import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { acceptFriend } from "@/lib/arenaSocial";

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId || "").trim();
  if (!userId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const db = getDb();
  const res = acceptFriend(db, session.id, userId);
  if (!res.ok) return NextResponse.json(res, { status: 400 });
  return NextResponse.json({ ok: true });
}
