import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getOrCreateWallet } from "@/lib/wallet";

type PayoutBody = {
  amount: number;
  currency?: string;
  meta?: any;
};

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });

  let body: PayoutBody;
  try {
    body = (await req.json()) as PayoutBody;
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_JSON" }, { status: 400 });
  }

  const db = getDb();

  const profile = db
    .prepare("SELECT currency FROM profiles WHERE user_id = ?")
    .get(user.id) as { currency?: string } | undefined;

  const currency = (body.currency || profile?.currency || "EUR").toUpperCase();
  const amount = Number(body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400 });
  }

  getOrCreateWallet(user.id, currency);

  const now = Date.now();

  const tx = db.transaction(() => {
    db.prepare("UPDATE wallets SET balance = balance + ?, updated_at = ? WHERE user_id = ? AND currency = ?").run(
      Number(amount.toFixed(2)),
      now,
      user.id,
      currency
    );

    // Legacy feed for /api/account/wallet (transactions list)
    db.prepare(
      "INSERT INTO transactions (id, user_id, type, amount, currency, status, created_at, meta) VALUES (?, ?, 'win', ?, ?, 'done', ?, ?)"
    ).run(
      randomUUID(),
      user.id,
      Number(amount.toFixed(2)),
      currency,
      now,
      JSON.stringify({ product: "casino", game: "robinson", ...(body.meta ? { meta: body.meta } : {}) })
    );

    db.prepare(
      "INSERT INTO wallet_transactions (id, user_id, type, amount, currency, product, ref_id, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      randomUUID(),
      user.id,
      "win",
      Number(amount.toFixed(2)),
      currency,
      "casino",
      null,
      JSON.stringify({ game: "robinson", ...(body.meta ? { meta: body.meta } : {}) }),
      now
    );
  });

  try {
    tx();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "PAYOUT_FAILED" }, { status: 500 });
  }

  const newRow = db
    .prepare("SELECT balance FROM wallets WHERE user_id = ? AND currency = ?")
    .get(user.id, currency) as { balance: number } | undefined;

  return NextResponse.json({ ok: true, currency, newBalance: Number(newRow?.balance ?? 0) });
}
