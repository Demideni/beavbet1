import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const Schema = z.object({
  amount: z.number().finite().positive().max(1000000),
  currency: z.enum(["USD", "EUR", "USDT", "BTC"]),
  method: z.string().min(2).max(32),
  details: z.string().max(240).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const db = getDb();
  // Calculate available
  const commAgg = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END),0) as approved
       FROM affiliate_commissions
       WHERE affiliate_user_id = ?`
    )
    .get(session.id) as { approved: number };

  const withdrawalsAgg = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('pending','approved') THEN amount ELSE 0 END),0) as reserved,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END),0) as paid
       FROM withdrawal_requests
       WHERE user_id = ?`
    )
    .get(session.id) as { reserved: number; paid: number };

  const available = Math.max(0, Number((commAgg.approved - withdrawalsAgg.reserved - withdrawalsAgg.paid).toFixed(2)));
  const amount = Number(parsed.data.amount.toFixed(2));
  if (amount > available) {
    return NextResponse.json({ ok: false, error: "INSUFFICIENT" }, { status: 400 });
  }

  const now = Date.now();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO withdrawal_requests
      (id, user_id, amount, currency, method, details, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(
    id,
    session.id,
    amount,
    parsed.data.currency,
    parsed.data.method,
    parsed.data.details ? String(parsed.data.details) : null,
    now,
    now
  );

  return NextResponse.json({ ok: true, id });
}
