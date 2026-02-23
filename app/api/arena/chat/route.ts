import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { addArenaChatMessage, listArenaChatMessages } from "@/lib/arenaChat";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));
  const messages = listArenaChatMessages(limit);
  return NextResponse.json({ ok: true, messages });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message = (body?.message ?? "").toString();

  try {
    const msg = addArenaChatMessage(user.id, message);
    return NextResponse.json({ ok: true, message: msg });
  } catch (e: any) {
    const code = String(e?.message || "BAD_REQUEST");
    const status = code === "EMPTY" || code === "TOO_LONG" ? 400 : 500;
    return NextResponse.json({ ok: false, error: code }, { status });
  }
}
