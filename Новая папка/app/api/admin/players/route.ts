import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session || !isAdminUser(session.id, session.email)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(200, Math.max(10, Number(url.searchParams.get("limit") || 50)));

  const db = getDb();
  const rows = q
    ? (db
        .prepare(
          `SELECT u.id, u.email, u.created_at,
                  COALESCE((SELECT SUM(balance) FROM wallets w WHERE w.user_id = u.id),0) as total_balance,
                  COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.user_id = u.id AND t.type='deposit' AND t.status='done'),0) as deposits_sum,
                  (SELECT MAX(created_at) FROM bets b WHERE b.user_id = u.id) as last_bet_at
             FROM users u
            WHERE LOWER(u.email) LIKE ?
            ORDER BY u.created_at DESC
            LIMIT ?`
        )
        .all(`%${q}%`, limit) as any[])
    : (db
        .prepare(
          `SELECT u.id, u.email, u.created_at,
                  COALESCE((SELECT SUM(balance) FROM wallets w WHERE w.user_id = u.id),0) as total_balance,
                  COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.user_id = u.id AND t.type='deposit' AND t.status='done'),0) as deposits_sum,
                  (SELECT MAX(created_at) FROM bets b WHERE b.user_id = u.id) as last_bet_at
             FROM users u
            ORDER BY u.created_at DESC
            LIMIT ?`
        )
        .all(limit) as any[]);

  return NextResponse.json({ ok: true, players: rows });
}
