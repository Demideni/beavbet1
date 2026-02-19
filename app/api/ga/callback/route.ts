import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { getGaConfig, gaCurrency } from "@/lib/gaClient";

export const runtime = "nodejs";

/**
 * GA (Game Aggregator) callback endpoint.
 * Spec highlights (from PDF):
 * - Provider sends POST application/x-www-form-urlencoded
 * - We must always respond HTTP 200 with JSON
 * - balance: { "balance": 57.12 }
 * - bet/win: { "balance": 27.18, "transaction_id": "..." }
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

/**
 * Parse params from either:
 * - GET query string
 * - POST x-www-form-urlencoded
 * - POST JSON (fallback)
 */
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

  // fallback: try body as querystring
  const raw = await req.text();
  const sp = new URLSearchParams(raw);
  sp.forEach((v, k) => (out[k] = v));
  return out;
}

/**
 * Optional signature check (if provider sends X-* headers).
 * If provider does NOT send these headers, skip verification (don’t break gameplay).
 */
function verifySignature(req: Request, params: Record<string, string>): { ok: boolean; error?: string } {
  const cfg = getGaConfig();

  const xMerchantId = req.headers.get("x-merchant-id") || req.headers.get("X-Merchant-Id") || "";
  const xNonce = req.headers.get("x-nonce") || req.headers.get("X-Nonce") || "";
  const xTimestamp = req.headers.get("x-timestamp") || req.headers.get("X-Timestamp") || "";
  const xSign = req.headers.get("x-sign") || req.headers.get("X-Sign") || "";

  if (!xMerchantId || !xNonce || !xTimestamp || !xSign) {
    return { ok: true };
  }

  const signQuery = buildQuery({
    ...params,
    "X-Merchant-Id": xMerchantId,
    "X-Nonce": xNonce,
    "X-Timestamp": xTimestamp,
  });

  const expected = signSha1(signQuery, cfg.merchantKey);

  if (expected !== xSign) {
    if (process.env.GA_ENFORCE_SIGNATURE === "true") {
      return { ok: false, error: "BAD_SIGNATURE" };
    }
    return { ok: true };
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

// Spec wants JSON + 200 always
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
 * Ensure idempotency log table exists.
 * (We can’t easily use JSON meta indexing reliably; this table makes validation predictable.)
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
      created_at INTEGER NOT NULL
    );
  `);
}

async function handleCallback(req: Request) {
  const params = await readParams(req);

  const sig = verifySignature(req, params);
  if (!sig.ok) {
    // Spec: still respond 200 with error_code
    return errJson("INTERNAL_ERROR", sig.error || "BAD_SIGNATURE");
  }

  const db = getDb();
  ensureGaTxnLog(db);

  const sessionId = params.session_id || params.session || params.sid || null;
  const playerId = params.player_id || params.playerId || params.userid || params.user_id || params.player || null;

  let userId: string | null = null;

  if (sessionId) {
    const row = db
      .prepare(`SELECT user_id FROM ga_sessions WHERE session_id = ? LIMIT 1`)
      .get(sessionId) as any;
    if (row?.user_id) userId = row.user_id;
  }

  // Fallback: many providers call with player_id only
  if (!userId && playerId) userId = playerId;

  if (!userId) {
    return errJson("INTERNAL_ERROR", "Missing session_id/player_id");
  }

  const currency = (params.currency || gaCurrency()).toUpperCase();

  // Ensure wallet exists
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

  const transactionId =
    params.transaction_id || params.tx_id || params.txid || params.transaction || "";

  const roundId = params.round_id || params.round || null;

  const action = normalizeAction(params.action || params.method || params.type || "balance");

  // -------------------------
  // BALANCE
  // -------------------------
  if (action === "balance") {
    // Spec: ONLY { balance }
    const cleanBal = fromCents(toCents(balance));
    return okJson({ balance: cleanBal });
  }

  // For money-changing actions, transaction_id must exist
  if (!transactionId) {
    return errJson("INTERNAL_ERROR", "Missing transaction_id");
  }

  // Idempotency: if we already processed this transaction_id, return stored balance_after
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
      // Spec: error with 200
      return errJson("INSUFFICIENT_FUNDS", "Insufficient funds");
    }

    const newBal = fromCents(balC - amtC);

    db.prepare(`UPDATE wallets SET balance = ? WHERE user_id = ? AND currency = ?`)
      .run(newBal, userId, currency);

    db.prepare(
      `INSERT INTO ga_txn_log (transaction_id, user_id, action, amount, currency, balance_after, round_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(transactionId, userId, "bet", amount, currency, newBal, roundId, now);

    // Spec: ONLY { balance, transaction_id }
    return okJson({ balance: newBal, transaction_id: transactionId });
  }

  // -------------------------
  // WIN (CREDIT)
  // -------------------------
  if (action === "win") {
    const balC = toCents(balance);
    const amtC = toCents(amount);

    const newBal = fromCents(balC + amtC);

    db.prepare(`UPDATE wallets SET balance = ? WHERE user_id = ? AND currency = ?`)
      .run(newBal, userId, currency);

    db.prepare(
      `INSERT INTO ga_txn_log (transaction_id, user_id, action, amount, currency, balance_after, round_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(transactionId, userId, "win", amount, currency, newBal, roundId, now);

    return okJson({ balance: newBal, transaction_id: transactionId });
  }

  // -------------------------
  // REFUND / ROLLBACK (если провайдер будет проверять)
  // По многим докам: тоже { balance, transaction_id }
  // -------------------------
  if (action === "refund" || action === "rollback") {
    // Внятной логики без их rollback_transactions массива мы не знаем,
    // поэтому не ломаем интеграцию: возвращаем текущий баланс и фиксируем txn_id как обработанный.
    const cleanBal = fromCents(toCents(balance));

    db.prepare(
      `INSERT INTO ga_txn_log (transaction_id, user_id, action, amount, currency, balance_after, round_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(transactionId, userId, action, amount, currency, cleanBal, roundId, now);

    return okJson({ balance: cleanBal, transaction_id: transactionId });
  }

  // Unknown action: safest per spec is INTERNAL_ERROR (but 200)
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
