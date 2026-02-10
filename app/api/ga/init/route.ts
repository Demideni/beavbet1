import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { gaInit, gaCurrency } from "@/lib/gaClient";
import { getDb, uuid } from "@/lib/db";

export const runtime = "nodejs";

const Body = z.object({
  game_uuid: z.string().min(1),
  is_mobile: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    // getSessionUser reads cookies() from next/headers; no request param is needed.
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const body = Body.parse(await req.json());
    const db = getDb();

    const sessionId = uuid();
    // store mapping for callbacks (session_id -> user_id)
    db.prepare(
      `INSERT INTO ga_sessions (session_id, user_id, created_at) VALUES (?, ?, ?)`,
    ).run(sessionId, user.id, Date.now());

    const baseUrl = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://beavbet.com";
    const returnUrl = `${baseUrl}/casino?ga=return`;

    const currency = gaCurrency(); // must be EUR for test
    const playerName = (user.email?.split("@")[0] || `player_${String(user.id).slice(0, 8)}`);

    // Ensure EUR wallet exists & seed for test so spins are enabled
const db2 = getDb();
db2.exec(`
  CREATE TABLE IF NOT EXISTS wallets (
    user_id TEXT NOT NULL,
    currency TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, currency)
  );
`);
const seed = Number(process.env.GA_SEED_EUR || 0);
const cur = "EUR";
const w = db2.prepare(`SELECT balance FROM wallets WHERE user_id = ? AND currency = ?`).get(String(user.id), cur) as any;
if (!w) {
  db2.prepare(`INSERT INTO wallets (user_id, currency, balance, updated_at) VALUES (?, ?, ?, ?)`)
    .run(String(user.id), cur, seed > 0 ? seed : 0, Date.now());
} else if (seed > 0 && Number(w.balance) <= 0) {
  db2.prepare(`UPDATE wallets SET balance = ?, updated_at = ? WHERE user_id = ? AND currency = ?`)
    .run(seed, Date.now(), String(user.id), cur);
}

    const resp = await gaInit({
      game_uuid: body.game_uuid,
      user_id: String(user.id),
      // Provider requires these fields
      player_id: String(user.id),
      player_name: playerName,
      session_id: sessionId,
      return_url: returnUrl,
      currency,
      language: "ru",
      is_mobile: !!body.is_mobile,
    });

    // Most providers return { url: "..." } or { data: { url } }
    const url = resp?.url || resp?.data?.url || resp?.game_url || resp?.data?.game_url;
    if (!url) {
      return NextResponse.json({ ok: false, error: "No url in GA init response", resp }, { status: 500 });
    }
    return NextResponse.json({ ok: true, url, sessionId, currency }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
