import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { joinCs2Duel } from "@/lib/arenaDuels";
import { cs2RconExec } from "@/lib/cs2Rcon";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const duelId = String(body?.duelId || "");
  if (!duelId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const r = joinCs2Duel(user.id, duelId);
  if (!r.ok) return NextResponse.json(r, { status: 400 });

  // Best-effort: set per-match server password via RCON (Variant B).
  // If RCON is not configured, the duel still works (players can connect manually).
  try {
    if ((r as any).server && (r as any).server_password) {
      const host = process.env.ARENA_CS2_HOST;
      const port = process.env.ARENA_CS2_PORT;
      if (host && port) {
        const expected = `${host}:${port}`;
        if (String((r as any).server) === expected) {
          const pass = String((r as any).server_password);
          await cs2RconExec(`sv_password "${pass}"`);
          await cs2RconExec("mp_restartgame 1");
        }
      }
    }
  } catch {
    // ignore
  }

  return NextResponse.json(r);
}
