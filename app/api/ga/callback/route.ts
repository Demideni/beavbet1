import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { gaCurrency } from "@/lib/gaClient";

export const runtime = "nodejs";

function envFirst(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

// parse x-www-form-urlencoded
async function readForm(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") || "";
  const text = await req.text();

  // accept either proper form or plain "a=b&c=d"
  const usp = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of usp.entries()) out[k] = v;
  // also allow empty body for GET tests
  if (!Object.keys(out).length && ct.includes("application/x-www-form-urlencoded") === false) {
    // noop
  }
  return out;
}

function buildQuerySorted(obj: Record<string, string | number>): string {
  const keys = Object.keys(obj).sort();
  const usp = new URLSearchParams();
  for (const k of keys) usp.append(k, String(obj[k]));
  return usp.toString();
}

function hmacSha1Hex(data: string, key: string) {
  return crypto.createHmac("sha1", key).update(data).digest("hex");
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

// Ensure EUR wallet exists and optionally seed
function ensureWalletAndMaybeSeed(userId: string, currency: string) {
  const db = getDb();

  // wallets table may be named differently — but in твоём проекте баланс обычно лежит в таблице wallets
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT NOT NULL,
      currency TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, currency)
    );
  `);

  const row = db
    .prepare(`SELECT balance FROM wallets WHERE user_id = ? AND currency = ?`)
    .get(userId, currency) as { balance?: number } | undefined;

  if (!row) {
    db.prepare(`INSERT INTO wallets (user_id, currency, balance, updated_at) VALUES (?, ?, ?, ?)`)
      .run(userId, currency, 0, Date.now());
  }

  const seedStr = envFirst("GA_SEED_EUR", "GA_SEED_BALANCE", "GA_TEST_BALANCE");
  const seed = seedStr ? Number(seedStr) : 0;

  // если seed задан и баланс нулевой — подсеять (для теста чтобы Spin стал активен)
  if (seed > 0) {
    const r2 = db
      .prepare(`SELECT balance FROM wallets WHERE user_id = ? AND currency = ?`)
      .get(userId, currency) as { balance: number };
    if (!r2 || !Number.isFinite(r2.balance) || r2.balance <= 0) {
      db.prepare(`UPDATE wallets SET balance = ?, updated_at = ? WHERE user_id = ? AND currency = ?`)
        .run(seed, Date.now(), userId, currency);
      return seed;
    }
  }

  const r3 = db
    .prepare(`SELECT balance FROM wallets WHERE user_id = ? AND currency = ?`)
    .get(userId, currency) as { balance: number };
  return Number(r3?.balance ?? 0);
}

function getBalance(userId: string, currency: string) {
  const db = getDb();
  const row = db
    .prepare(`SELECT balance FROM wallets WHERE user_id = ? AND currency = ?`)
    .get(userId, currency) as { balance?: number } | undefined;
  return Number(row?.balance ?? 0);
}

function setBalance(userId: string, currency: string, balance: number) {
  const db = getDb();
  db.prepare(`UPDATE wallets SET balance = ?, updated_at = ? WHERE user_id = ? AND currency = ?`)
    .run(balance, Date.now(), userId, currency);
  return balance;
}

// idempotency table for GA transactions
function ensureTxTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS ga_transactions (
      tx_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);
}

function hasTx(txId: string) {
  const db = getDb();
  const row = db.prepare(`SELECT tx_id FROM ga_transactions WHERE tx_id = ?`).get(txId);
  return !!row;
}

function saveTx(txId: string, userId: string, action: string, amount: number) {
  const db = getDb();
  db.prepare(`INSERT INTO ga_transactions (tx_id, user_id, action, amount, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(txId, userId, action, amount, Date.now());
}

export async function GET() {
  // чтобы в браузере не было 404
  return NextResponse.json({
    ok: true,
    note: "GA wallet callback. Use POST application/x-www-form-urlencoded.",
  });
}

export async function POST(req: Request) {
  try {
    const merchantId = envFirst("GA_MERCHANT_ID", "MERCHANT_ID", "GAMEROUTER_MERCHANT_ID");
    const merchantKey = envFirst("GA_MERCHANT_KEY", "MERCHANT_KEY", "GAMEROUTER_MERCHANT_KEY");
    if (!merchantId) return NextResponse.json({ error_code: 1, error_description: "MERCHANT_ID_MISSING" });
    if (!merchantKey) return NextResponse.json({ error_code: 1, error_description: "MERCHANT_KEY_MISSING" });

    const xMerchantId = req.headers.get("x-merchant-id") || req.headers.get("X-Merchant-Id") || "";
    const xNonce = req.headers.get("x-nonce") || req.headers.get("X-Nonce") || "";
    const xTimestamp = req.headers.get("x-timestamp") || req.headers.get("X-Timestamp") || "";
    const xSign = req.headers.get("x-sign") || req.headers.get("X-Sign") || "";

    // basic header validation
    if (!xMerchantId || !xNonce || !xTimestamp || !xSign) {
      return NextResponse.json({ error_code: 2, error_description: "MISSING_SIGNATURE_HEADERS" });
    }
    if (xMerchantId !== merchantId) {
      return NextResponse.json({ error_code: 3, error_description: "INVALID_MERCHANT_ID" });
    }

    const ts = Number(xTimestamp);
    if (!Number.isFinite(ts)) return NextResponse.json({ error_code: 4, error_description: "INVALID_TIMESTAMP" });
    if (Math.abs(nowSec() - ts) > 60) {
      return NextResponse.json({ error_code: 5, error_description: "TIMESTAMP_OUT_OF_RANGE" });
    }

    const form = await readForm(req);

    // signature base: merge params + header values, sort, querystring, hmac-sha1
    const signedParams: Record<string, string | number> = {
      ...form,
      "X-Merchant-Id": merchantId,
      "X-Nonce": xNonce,
      "X-Timestamp": ts,
    };
    const query = buildQuerySorted(signedParams);
    const expected = hmacSha1Hex(query, merchantKey);
    if (expected !== xSign) {
      return NextResponse.json({ error_code: 6, error_description: "INVALID_SIGNATURE" });
    }

    ensureTxTable();

    const action = (form.action || "").toLowerCase();

    // player id can arrive as player_id or user_id
    const playerId = form.player_id || form.user_id || "";
    if (!playerId) return NextResponse.json({ error_code: 7, error_description: "MISSING_PLAYER_ID" });

    const currency = (form.currency || gaCurrency() || "EUR").toUpperCase();
    // обязуемся тестить только EUR (как они просили)
    if (currency !== "EUR") {
      return NextResponse.json({ error_code: 8, error_description: "ONLY_EUR_ALLOWED_ON_TEST" });
    }

    // ensure wallet exists & seed if needed
    ensureWalletAndMaybeSeed(String(playerId), currency);

    if (action === "balance") {
      const balance = getBalance(String(playerId), currency);
      return NextResponse.json({ balance });
    }

    // bet/win usually send amount + transaction_id
    const amount = Number(form.amount ?? form.sum ?? 0);
    const txId = form.transaction_id || form.tx_id || form.bet_transaction_id || "";

    if (!txId) {
      return NextResponse.json({ error_code: 9, error_description: "MISSING_TRANSACTION_ID" });
    }

    // idempotency: if tx already processed, return current balance without changing
    if (hasTx(txId)) {
      const balance = getBalance(String(playerId), currency);
      return NextResponse.json({ balance, transaction_id: txId });
    }

    let balance = getBalance(String(playerId), currency);

    if (action === "bet" || action === "debit") {
      if (!(amount > 0)) return NextResponse.json({ error_code: 10, error_description: "INVALID_AMOUNT" });
      if (balance < amount) return NextResponse.json({ error_code: 11, error_description: "INSUFFICIENT_FUNDS" });

      balance = setBalance(String(playerId), currency, balance - amount);
      saveTx(txId, String(playerId), action, amount);
      return NextResponse.json({ balance, transaction_id: txId });
    }

    if (action === "win" || action === "credit") {
      if (!(amount >= 0)) return NextResponse.json({ error_code: 10, error_description: "INVALID_AMOUNT" });

      balance = setBalance(String(playerId), currency, balance + amount);
      saveTx(txId, String(playerId), action, amount);
      return NextResponse.json({ balance, transaction_id: txId });
    }

    if (action === "refund" || action === "rollback") {
      // simplest test: just acknowledge and return balance
      saveTx(txId, String(playerId), action, amount || 0);
      balance = getBalance(String(playerId), currency);
      return NextResponse.json({ balance, transaction_id: txId });
    }

    return NextResponse.json({ error_code: 12, error_description: `UNKNOWN_ACTION:${action}` });
  } catch (e: any) {
    return NextResponse.json({ error_code: 500, error_description: e?.message ?? String(e) });
  }
}
