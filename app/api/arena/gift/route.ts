import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { publishToUser } from "@/lib/arenaNotify";

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const toUserId = String(body?.toUserId || "").trim();
  const currency = String(body?.currency || "EUR").trim().toUpperCase();
  const amount = Number(body?.amount);
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 140) : null;

  if (!toUserId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }
  if (currency !== "EUR") {
    return NextResponse.json({ ok: false, error: "ONLY_EUR_FOR_NOW" }, { status: 400 });
  }
  if (toUserId === session.id) {
    return NextResponse.json({ ok: false, error: "SELF" }, { status: 400 });
  }

  const db = getDb();
  const toExists = db.prepare("SELECT id FROM users WHERE id = ?").get(toUserId);
  if (!toExists) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const now = Date.now();

  // Ensure wallets exist
  const ensureWallet = (userId: string) => {
    const w = db.prepare("SELECT id, balance FROM wallets WHERE user_id = ? AND currency = ?").get(userId, currency) as any;
    if (w) return w;
    const id = randomUUID();
    db.prepare("INSERT INTO wallets (id, user_id, currency, balance, locked_balance, created_at) VALUES (?, ?, ?, 0, 0, ?)").run(
      id,
      userId,
      currency,
      now
    );
    return db.prepare("SELECT id, balance FROM wallets WHERE user_id = ? AND currency = ?").get(userId, currency) as any;
  };

  const fromW = ensureWallet(session.id);
  const toW = ensureWallet(toUserId);

  if ((fromW?.balance ?? 0) < amount) {
    return NextResponse.json({ ok: false, error: "INSUFFICIENT_FUNDS" }, { status: 400 });
  }

  // Atomic-ish in sqlite: use transaction
  const tx = db.transaction(() => {
    db.prepare("UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND currency = ?").run(amount, session.id, currency);
    db.prepare("UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND currency = ?").run(amount, toUserId, currency);

    const giftId = randomUUID();
    db.prepare(
      "INSERT INTO arena_gifts (id, from_user_id, to_user_id, amount, currency, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(giftId, session.id, toUserId, amount, currency, note, now);

    const outTx = randomUUID();
    const inTx = randomUUID();
    db.prepare(
      "INSERT INTO transactions (id, user_id, type, amount, currency, status, created_at) VALUES (?, ?, 'gift_out', ?, ?, 'done', ?)"
    ).run(outTx, session.id, -amount, currency, now);
    db.prepare(
      "INSERT INTO transactions (id, user_id, type, amount, currency, status, created_at) VALUES (?, ?, 'gift_in', ?, ?, 'done', ?)"
    ).run(inTx, toUserId, amount, currency, now);

    return giftId;
  });

  const giftId = tx();

  const fromNick = (db.prepare("SELECT nickname FROM profiles WHERE user_id = ?").get(session.id) as any)?.nickname ?? null;

  publishToUser(toUserId, { type: "gift", fromUserId: session.id, fromNick, amount, currency, createdAt: now });

  return NextResponse.json({ ok: true, giftId });
}
