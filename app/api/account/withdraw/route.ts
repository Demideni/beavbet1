import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const Schema = z.object({
  amount: z.number().finite().positive().max(1000000),
  currency: z.enum(["USD", "EUR", "USDT", "BTC"]),
});

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { amount, currency } = parsed.data;
  const db = getDb();
  const now = Date.now();

  const w = db
    .prepare("SELECT id, balance FROM wallets WHERE user_id = ? AND currency = ?")
    .get(session.id, currency) as { id: string; balance: number } | undefined;

  if (!w || w.balance < amount) {
    return NextResponse.json({ ok: false, error: "INSUFFICIENT" }, { status: 400 });
  }

  const txId = randomUUID();
  const trx = db.transaction(() => {
    db.prepare("UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND currency = ?").run(
      amount,
      session.id,
      currency
    );
    db.prepare(
      "INSERT INTO transactions (id, user_id, type, amount, currency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(txId, session.id, "withdraw", amount, currency, "done", now);
  });
  trx();

  const updated = db
    .prepare("SELECT currency, balance FROM wallets WHERE user_id = ? AND currency = ?")
    .get(session.id, currency) as { currency: string; balance: number };

  return NextResponse.json({ ok: true, wallet: updated, txId });
}
