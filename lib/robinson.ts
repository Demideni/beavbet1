import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

const GAME_KEY = "robinson";
const DEFAULT_CURRENCY = "USD";

export function ensureWallet(userId: string, currency: string = DEFAULT_CURRENCY) {
  const db = getDb();
  const w = db
    .prepare(`SELECT * FROM wallets WHERE user_id=? AND currency=? LIMIT 1`)
    .get(userId, currency) as any | undefined;

  if (w) return w;

  const id = randomUUID();
  db.prepare(
    `INSERT INTO wallets (id, user_id, currency, balance, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, userId, currency, 0, Date.now());

  return db.prepare(`SELECT * FROM wallets WHERE id=? LIMIT 1`).get(id) as any;
}

export function getBalance(userId: string, currency: string = DEFAULT_CURRENCY) {
  const w = ensureWallet(userId, currency);
  return Number(w.balance || 0);
}

export function placeBet(userId: string, bet: number, currency: string = DEFAULT_CURRENCY) {
  const db = getDb();
  const w = ensureWallet(userId, currency);
  const bal = Number(w.balance || 0);

  if (bet <= 0 || !Number.isFinite(bet)) throw new Error("Invalid bet");
  if (bal < bet) throw new Error("Insufficient balance");

  const roundId = randomUUID();

  db.prepare(`UPDATE wallets SET balance=? WHERE id=?`).run(bal - bet, w.id);

  db.prepare(
    `INSERT INTO transactions (id, user_id, type, amount, currency, status, created_at, meta)
     VALUES (?, ?, 'bet', ?, ?, 'done', ?, ?)`
  ).run(randomUUID(), userId, -Math.abs(bet), currency, Date.now(), JSON.stringify({ game: GAME_KEY, roundId }));

  db.prepare(
    `INSERT INTO game_rounds (id, user_id, game_key, bet, currency, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`
  ).run(roundId, userId, GAME_KEY, bet, currency, Date.now());

  return { roundId, balance: bal - bet };
}

export function finishRound(userId: string, roundId: string, multiplier: number, result: "won" | "lost") {
  const db = getDb();
  const r = db
    .prepare(`SELECT * FROM game_rounds WHERE id=? AND user_id=? LIMIT 1`)
    .get(roundId, userId) as any | undefined;

  if (!r) throw new Error("Round not found");
  if (r.status !== "open") {
    return { balance: getBalance(userId, r.currency) };
  }

  const bet = Number(r.bet || 0);
  const currency = String(r.currency || DEFAULT_CURRENCY);
  const won = result === "won";
  const mult = Number(multiplier || 1);

  let payout = 0;
  if (won) payout = bet * Math.max(0, mult);

  const w = ensureWallet(userId, currency);
  const bal = Number(w.balance || 0);
  const newBal = bal + payout;

  db.prepare(`UPDATE wallets SET balance=? WHERE id=?`).run(newBal, w.id);

  if (won && payout > 0) {
    db.prepare(
      `INSERT INTO transactions (id, user_id, type, amount, currency, status, created_at, meta)
       VALUES (?, ?, 'win', ?, ?, 'done', ?, ?)`
    ).run(randomUUID(), userId, payout, currency, Date.now(), JSON.stringify({ game: GAME_KEY, roundId, multiplier: mult }));
  } else {
    db.prepare(
      `INSERT INTO transactions (id, user_id, type, amount, currency, status, created_at, meta)
       VALUES (?, ?, 'lose', ?, ?, 'done', ?, ?)`
    ).run(randomUUID(), userId, 0, currency, Date.now(), JSON.stringify({ game: GAME_KEY, roundId, multiplier: mult }));
  }

  db.prepare(
    `UPDATE game_rounds SET status='settled', result=?, multiplier=?, settled_at=? WHERE id=?`
  ).run(result, mult, Date.now(), roundId);

  return { balance: newBal, won, payout, multiplier: mult, bet, currency };
}
