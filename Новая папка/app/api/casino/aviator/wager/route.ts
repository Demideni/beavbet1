import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getOrCreateWallet } from "@/lib/wallet";

type WagerBody = {
  amount: number;
  currency?: string;
  meta?: any;
};

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });

  let body: WagerBody;
  try {
    body = (await req.json()) as WagerBody;
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

  const w = db
    .prepare("SELECT balance FROM wallets WHERE user_id = ? AND currency = ?")
    .get(user.id, currency) as { balance: number } | undefined;

  const balance = Number(w?.balance ?? 0);
  if (balance < amount) {
    return NextResponse.json({ ok: false, error: "INSUFFICIENT_FUNDS" }, { status: 400 });
  }

  const now = Date.now();

  const tx = db.transaction(() => {
    db.prepare("UPDATE wallets SET balance = balance - ?, updated_at = ? WHERE user_id = ? AND currency = ?").run(
      Number(amount.toFixed(2)),
      now,
      user.id,
      currency
    );

    // Legacy feed for /api/account/wallet (transactions list)
    db.prepare(
      "INSERT INTO transactions (id, user_id, type, amount, currency, status, created_at, meta) VALUES (?, ?, 'bet', ?, ?, 'done', ?, ?)"
    ).run(
      randomUUID(),
      user.id,
      Number(amount.toFixed(2)),
      currency,
      now,
      JSON.stringify({ product: "casino", game: "aviator", ...(body.meta ? { meta: body.meta } : {}) })
    );

    db.prepare(
      "INSERT INTO wallet_transactions (id, user_id, type, amount, currency, product, ref_id, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      randomUUID(),
      user.id,
      "bet",
      Number(amount.toFixed(2)),
      currency,
      "casino",
      null,
      JSON.stringify({ game: "aviator", ...(body.meta ? { meta: body.meta } : {}) }),
      now
    );
  });

  try {
    tx();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "WAGER_FAILED" }, { status: 500 });
  }

  const newRow = db
    .prepare("SELECT balance FROM wallets WHERE user_id = ? AND currency = ?")
    .get(user.id, currency) as { balance: number } | undefined;

  return NextResponse.json({ ok: true, currency, newBalance: Number(newRow?.balance ?? 0) });
}
