import { NextRequest, NextResponse } from "next/server";
import { finalizeDuel } from "@/lib/arenaDuels";

/**
 * This endpoint is for server-side verification (plugin / log service).
 * Protect it with ARENA_MATCH_WEBHOOK_SECRET.
 *
 * POST { duelId, winnerUserId, token }
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ARENA_MATCH_WEBHOOK_SECRET || "";
  const body = await req.json().catch(() => ({}));

  const duelId = String(body?.duelId || "");
  const winnerUserId = String(body?.winnerUserId || "");
  const token = String(body?.token || "");

  if (!duelId || !winnerUserId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  // If secret is set, require it + token (match token stored in duel row is checked in finalize step by plugin side)
  if (secret) {
    const hdr = req.headers.get("x-arena-secret") || "";
    if (hdr !== secret) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const r = finalizeDuel(duelId, winnerUserId, "server");
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json({ ok: true, ...r });
}
