import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getDb } from "@/lib/db";

const Schema = z.object({
  userId: z.string().min(8).max(64),
  currency: z.enum(["USD", "EUR", "USDT", "BTC"]),
  amount: z.number().finite().min(-1000000).max(1000000),
  reason: z.string().max(140).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session || !isAdminUser(session.id, session.email)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { userId, currency, amount } = parsed.data;
  if (amount === 0) return NextResponse.json({ ok: false, error: "ZERO" }, { status: 400 });

  const db = getDb();
  const now = Date.now();

  // Ensure wallet exists
  const w = db
    .prepare("SELECT id, balance FROM wallets WHERE user_id = ? AND currency = ?")
    .get(userId, currency) as { id: string; balance: number } | undefined;
  if (!w) {
    db.prepare(
      "INSERT INTO wallets (id, user_id, currency, balance, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(randomUUID(), userId, currency, 0, now);
  }

  // Apply update atomically
  const txId = randomUUID();
  const auditId = randomUUID();
  const trx = db.transaction(() => {
    db.prepare("UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND currency = ?").run(
      amount,
      userId,
      currency
    );
    db.prepare(
      "INSERT INTO transactions (id, user_id, type, amount, currency, status, created_at, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      txId,
      userId,
      amount > 0 ? "admin_credit" : "admin_debit",
      Math.abs(amount),
      currency,
      "done",
      now,
      JSON.stringify({ reason: parsed.data.reason || null, adminId: session.id })
    );
    db.prepare(
      "INSERT INTO admin_audit_log (id, admin_id, action, target_user_id, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      auditId,
      session.id,
      "BALANCE_ADJUST",
      userId,
      JSON.stringify({ currency, amount, reason: parsed.data.reason || null }),
      now
    );
  });
  trx();

  const updated = db
    .prepare("SELECT currency, balance FROM wallets WHERE user_id = ? AND currency = ?")
    .get(userId, currency) as { currency: string; balance: number };

  return NextResponse.json({ ok: true, wallet: updated, txId });
}
