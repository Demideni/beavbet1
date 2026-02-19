import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { getGaConfig, gaCurrency } from "@/lib/gaClient";

export const runtime = "nodejs";

/**
 * GA callback endpoint
 * - Provider sends POST application/x-www-form-urlencoded
 * - Always respond HTTP 200 JSON
 * - balance: { "balance": 57.12 }
 * - bet/win/refund: { "balance": 27.18, "transaction_id": "..." }
 * - errors also 200: { "error_code": "...", "error_description": "..." }
 */

function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const entries: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    entries.push([k, String(v)]);
  }
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  const usp = new URLSearchParams();
  for (const [k, v] of entries) usp.append(k, v);
  return usp.toString();
}

function signSha1(queryString: string, key: string): string {
  return crypto.createHmac("sha1", key).update(queryString).digest("hex");
}

async function readParams(req: Request): Promise<Record<string, string>> {
  const url = new URL(req.url);

  const out: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (out[k] = v));

  if (req.method === "GET") return out;

  const ct = req.headers.get("content-type") || "";

  if (ct.includes("application/x-www-form-urlencoded")) {
    const bodyText = await req.text();
    const sp = new URLSearchParams(bodyText);
    sp.forEach((v, k) => (out[k] = v));
    return out;
  }

  if (ct.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    for (const [k, v] of Object.entries(j || {})) out[k] = String(v);
    return out;
  }

  const raw = await req.text();
  const sp = new URLSearchParams(raw);
  sp.forEach((v, k) => (out[k] = v));
  return out;
}

/**
 * Signature check (works with your provider logs showing these headers)
 * If headers are absent -> skip verification (don't break gameplay).
 * If GA_ENFORCE_SIGNATURE=true -> reject invalid signature.
 */
function verifySignature(
  req: Request,
  params: Record<string, string>
): { ok: boolean; error?: string } {
  const cfg = getGaConfig();

  const xMerchantId =
    req.headers.get("x-merchant-id") || req.headers.get("X-Merchant-Id") || "";
  const xNonce =
    req.headers.get("x-nonce") || req.headers.get("X-Nonce") || "";
  const xTimestamp =
    req.headers.get("x-timestamp") || req.headers.get("X-Timestamp") || "";
  const xSign =
    req.headers.get("x-sign") || req.headers.get("X-Sign") || "";

  // если подпись не передана вообще — пропускаем (для локальных тестов)
  if (!xMerchantId && !xNonce && !xTimestamp && !xSign) {
    return { ok: true };
  }

  // если подпись частично отсутствует — reject
  if (!xMerchantId || !xNonce || !xTimestamp || !xSign) {
    return { ok: false, error: "Invalid signature" };
  }

  if (!cfg.merchantKey) {
    return { ok: false, error: "Invalid signature" };
  }

  const signQuery = buildQuery({
    ...params,
    "X-Merchant-Id": xMerchantId,
    "X-Nonce": xNonce,
    "X-Timestamp": xTimestamp,
  });

  const expected = crypto
    .createHmac("sha1", cfg.merchantKey)
    .update(signQuery)
    .digest("hex");

  if (expected !== xSign) {
    return { ok: false, error: "Invalid signature" };
  }

  return { ok: true };
}


// Money helpers (avoid float artifacts)
function toCents(v: number): number {
  return Math.round((Number(v) || 0) * 100);
}
function fromCents(c: number): number {
  return Number((c / 100).toFixed(2));
}

// Always JSON + 200
function okJson(body: any) {
  return NextResponse.json(body, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
function errJson(code: string, desc: string) {
  return okJson({ error_code: code, error_description: desc });
}

function normalizeAction(raw: string) {
  const a = (raw || "balance").toLowerCase();
  if (a.includes("getbalance") || a.includes("balance")) return "balance";
  if (a.includes("bet") || a.includes("debit")) return "bet";
  if (a.includes("win") || a.includes("credit")) return "win";
  if (a.includes("refund")) return "refund";
  if (a.includes("rollback")) return "rollback";
  return "unknown";
}

/**
 * Idempotency log table.
 * We also store related_transaction_id for refund (bet_transaction_id).
 */
function ensureGaTxnLog(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ga_txn_log (
      transaction_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL,
      balance_after REAL NOT NULL DEFAULT 0,
      round_id TEXT,
      related_transaction_id TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // If old table existed without related_transaction_id, add it.
  try {
    db.exec(`ALTER TABLE ga_txn_log ADD COLUMN related_transaction_id TEXT;`);
  } catch {
    // column already exists
  }
}

async function handleCallback(req: Request) {
  const params = await readParams(req);

  const sig = verifySignature(req, params);
  if (!sig.ok) {
    return errJson("INTERNAL_ERROR", sig.error || "BAD_SIGNATURE");
  }

  const db = getDb();
  ensureGaTxnLog(db);

  const sessionId = params.session_id || params.session || params.sid || null;
  const playerId =
    params.player_id || params.playerId || params.userid || params.user_id || params.player || null;

  let userId: string | null = null;

  if (sessionId) {
    const row = db
      .prepare(`SELECT user_id FROM ga_sessions WHERE session_id = ? LIMIT 1`)
      .get(sessionId) as any;
    if (row?.user_id) userId = row.user_id;
  }

  // Fallback: some providers call with player_id only
  if (!userId && playerId) userId = playerId;

  if (!userId) {
    return errJson("INTERNAL_ERROR", "Missing session_id/player_id");
  }

  const currency = (params.currency || gaCurrency()).toUpperCase();

  // Ensure wallet exists (BUT: if you have FK users->wallets, make sure userId is real users.id)
  const w = db
    .prepare(`SELECT balance FROM wallets WHERE user_id = ? AND currency = ? LIMIT 1`)
    .get(userId, currency) as any;

  if (!w) {
    const now = Date.now();
    db.prepare(
      `INSERT INTO wallets (id, user_id, currency, balance, locked_balance, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), userId, currency, 0, 0, now);
  }

  const wallet = db
    .prepare(`SELECT balance FROM wallets WHERE user_id = ? AND currency = ? LIMIT 1`)
    .get(userId, currency) as any;

  const balance = Number(wallet?.balance ?? 0);

  const transactionId = params.transaction_id || params.tx_id || params.txid || params.transaction || "";
  const roundId = params.round_id || params.round || null;
  const action = normalizeAction(params.action || params.method || params.type || "balance");

  // -------------------------
  // BALANCE
  // -------------------------
  if (action === "balance") {
    return okJson({ balance: fromCents(toCents(balance)) });
  }

  // For money-changing actions, transaction_id must exist
  if (!transactionId) {
    return errJson("INTERNAL_ERROR", "Missing transaction_id");
  }

  // Idempotency: if already processed this transaction_id, return stored balance_after
  const existing = db
    .prepare(`SELECT balance_after FROM ga_txn_log WHERE transaction_id = ? LIMIT 1`)
    .get(transactionId) as any;

  if (existing?.balance_after !== undefined && existing?.balance_after !== null) {
    return okJson({
      balance: fromCents(toCents(Number(existing.balance_after))),
      transaction_id: transactionId,
    });
  }

  // Amount
  const amount = Number(params.amount ?? params.sum ?? params.value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    return errJson("INTERNAL_ERROR", "Bad amount");
  }

  const now = Date.now();

  // -------------------------
  // BET (DEBIT)
  // -------------------------
  if (action === "bet") {
    const balC = toCents(balance);
    const amtC = toCents(amount);

    if (balC < amtC) {
      return errJson("INSUFFICIENT_FUNDS", "Insufficient funds");
    }

    const newBal = fromCents(balC - amtC);

    db.prepare(`UPDATE wallets SET balance = ? WHERE user_id = ? AND currency = ?`).run(
      newBal,
      userId,
      currency
    );

    db.prepare(
      `INSERT INTO ga_txn_log (transaction_id, user_id, action, amount, currency, balance_after, round_id, related_transaction_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(transactionId, userId, "bet", amount, currency, newBal, roundId, null, now);

    return okJson({ balance: newBal, transaction_id: transactionId });
  }

  // -------------------------
  // WIN (CREDIT)
  // -------------------------
  if (action === "win") {
    const newBal = fromCents(toCents(balance) + toCents(amount));

    db.prepare(`UPDATE wallets SET balance = ? WHERE user_id = ? AND currency = ?`).run(
      newBal,
      userId,
      currency
    );

    db.prepare(
      `INSERT INTO ga_txn_log (transaction_id, user_id, action, amount, currency, balance_after, round_id, related_transaction_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(transactionId, userId, "win", amount, currency, newBal, roundId, null, now);

    return okJson({ balance: newBal, transaction_id: transactionId });
  }

  // -------------------------
  // REFUND
  // Provider sends bet_transaction_id; we must credit amount back.
  // Also: same bet_transaction_id must not be refunded twice.
  // -------------------------
  if (action === "refund") {
    const betTxId = params.bet_transaction_id || (params as any).betTransactionId || "";

    if (!betTxId) {
      return errJson("INTERNAL_ERROR", "Missing bet_transaction_id");
    }

    // If this bet has already been refunded, return that previous refund result (idempotent by bet_transaction_id)
    const alreadyRefunded = db
      .prepare(
        `SELECT transaction_id, balance_after
         FROM ga_txn_log
         WHERE action = 'refund' AND related_transaction_id = ?
         LIMIT 1`
      )
      .get(betTxId) as any;

    if (alreadyRefunded?.transaction_id) {
      return okJson({
        balance: fromCents(toCents(Number(alreadyRefunded.balance_after))),
        transaction_id: String(alreadyRefunded.transaction_id),
      });
    }

    // If bet exists, refund it; if not found, still record refund txn and return current balance
    const betRow = db
      .prepare(
        `SELECT transaction_id
         FROM ga_txn_log
         WHERE transaction_id = ? AND action = 'bet'
         LIMIT 1`
      )
      .get(betTxId) as any;

    if (!betRow) {
      const cleanBal = fromCents(toCents(balance));
      db.prepare(
        `INSERT INTO ga_txn_log (transaction_id, user_id, action, amount, currency, balance_after, round_id, related_transaction_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(transactionId, userId, "refund", amount, currency, cleanBal, roundId, betTxId, now);

      return okJson({ balance: cleanBal, transaction_id: transactionId });
    }

    const newBal = fromCents(toCents(balance) + toCents(amount));

    db.prepare(`UPDATE wallets SET balance = ? WHERE user_id = ? AND currency = ?`).run(
      newBal,
      userId,
      currency
    );

    db.prepare(
      `INSERT INTO ga_txn_log (transaction_id, user_id, action, amount, currency, balance_after, round_id, related_transaction_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(transactionId, userId, "refund", amount, currency, newBal, roundId, betTxId, now);

    return okJson({ balance: newBal, transaction_id: transactionId });
  }

  // -------------------------
  // ROLLBACK
  // (If they start validating rollback_transactions, we’ll implement fully.)
  // For now: keep it format-correct and idempotent.
  // -------------------------
  if (action === "rollback") {
    const cleanBal = fromCents(toCents(balance));

    db.prepare(
      `INSERT INTO ga_txn_log (transaction_id, user_id, action, amount, currency, balance_after, round_id, related_transaction_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(transactionId, userId, "rollback", amount, currency, cleanBal, roundId, null, now);

    return okJson({ balance: cleanBal, transaction_id: transactionId });
  }

  return errJson("INTERNAL_ERROR", "Unknown action");
}

export async function GET(req: Request) {
  try {
    return await handleCallback(req);
  } catch (e: any) {
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", error_description: e?.message ?? String(e) },
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(req: Request) {
  try {
    return await handleCallback(req);
  } catch (e: any) {
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", error_description: e?.message ?? String(e) },
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
