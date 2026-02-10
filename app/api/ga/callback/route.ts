import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Wallet callback (seamless).
 * Provider may call GET or POST with params in query or form.
 *
 * We support:
 * - player_id OR user_id
 * - session_id (preferred for mapping) OR direct player_id
 *
 * Operations:
 * - balance (get current balance)
 * - debit (place bet)
 * - credit (win)
 *
 * NOTE: If your provider uses different method names, just map them below.
 */

function baseJson(res: any, status = 200) {
  return NextResponse.json(res, { status });
}

async function readParams(req: Request): Promise<Record<string, string>> {
  const url = new URL(req.url);
  const out: Record<string, string> = {};

  // query params
  url.searchParams.forEach((v, k) => {
    out[k] = v;
  });

  // body params (form or json)
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j = (await req.json()) as any;
      if (j && typeof j === "object") {
        for (const [k, v] of Object.entries(j)) out[k] = String(v);
      }
    } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) out[k] = String(v);
    }
  } catch {
    // ignore body parse errors, query params are enough for many providers
  }

  return out;
}

function num(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function normalizeCurrency(v?: string) {
  return (v || "EUR").toUpperCase();
}

function normalizeMethod(p: Record<string, string>) {
  // common names seen in providers
  return (
    p.method ||
    p.action ||
    p.command ||
    p.type ||
    ""
  ).toLowerCase();
}

function normalizeAmount(p: Record<string, string>) {
  // amount / sum / value
  return num(p.amount ?? p.sum ?? p.value ?? 0, 0);
}

function normalizePlayerId(p: Record<string, string>) {
  return p.player_id ?? p.user_id ?? "";
}

function normalizeSessionId(p: Record<string, string>) {
  return p.session_id ?? p.session ?? "";
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  try {
    const p = await readParams(req);
    const db = getDb();

    // ensure tables exist (NO updated_at)
    db.exec(`
      CREATE TABLE IF NOT EXISTS ga_sessions (
        session_id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS wallets (
        user_id INTEGER NOT NULL,
        currency TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, currency)
      );
    `);

    const currency = normalizeCurrency(p.currency);
    const method = normalizeMethod(p);

    // Resolve user_id:
    // 1) via session_id mapping (best)
    // 2) via player_id directly (fallback)
    const sessionId = normalizeSessionId(p);
    let userId: number | null = null;

    if (sessionId) {
      const row = db.prepare(`
        SELECT user_id FROM ga_sessions WHERE session_id = ?
      `).get(sessionId) as { user_id: number } | undefined;

      if (row?.user_id != null) userId = Number(row.user_id);
    }

    if (userId == null) {
      const pid = normalizePlayerId(p);
      if (pid && String(pid).trim()) userId = Number(pid);
    }

    if (userId == null || !Number.isFinite(userId)) {
      return baseJson({ ok: false, error: "Missing player_id/session_id mapping" }, 400);
    }

    // Ensure wallet exists
    const w = db.prepare(`
      SELECT balance FROM wallets WHERE user_id = ? AND currency = ?
    `).get(userId, currency) as { balance: number } | undefined;

    if (!w) {
      db.prepare(`
        INSERT INTO wallets (user_id, currency, balance)
        VALUES (?, ?, ?)
      `).run(userId, currency, 0);
    }

    const getBalance = () => {
      const r = db.prepare(`
        SELECT balance FROM wallets WHERE user_id = ? AND currency = ?
      `).get(userId, currency) as { balance: number } | undefined;

      return num(r?.balance ?? 0, 0);
    };

    const setBalance = (newBal: number) => {
      db.prepare(`
        UPDATE wallets
        SET balance = ?
        WHERE user_id = ? AND currency = ?
      `).run(newBal, userId, currency);
    };

    // Map provider actions -> our actions
    // Adjust these strings if provider uses other names.
    const isBalance =
      method === "balance" ||
      method === "getbalance" ||
      method === "get_balance" ||
      method === "wallet" ||
      method === "ping";

    const isDebit =
      method === "debit" ||
      method === "bet" ||
      method === "placebet" ||
      method === "withdraw" ||
      method === "charge";

    const isCredit =
      method === "credit" ||
      method === "win" ||
      method === "payout" ||
      method === "deposit" ||
      method === "refund";

    if (isBalance) {
      const bal = getBalance();
      // return shape: many providers accept any JSON with balance field
      return baseJson({ ok: true, balance: bal, currency }, 200);
    }

    if (isDebit) {
      const amount = normalizeAmount(p);
      if (amount <= 0) return baseJson({ ok: false, error: "Invalid amount" }, 400);

      const bal = getBalance();
      if (bal < amount) {
        return baseJson({ ok: false, error: "INSUFFICIENT_FUNDS", balance: bal, currency }, 200);
      }
      const newBal = bal - amount;
      setBalance(newBal);
      return baseJson({ ok: true, balance: newBal, currency }, 200);
    }

    if (isCredit) {
      const amount = normalizeAmount(p);
      if (amount <= 0) return baseJson({ ok: false, error: "Invalid amount" }, 400);

      const bal = getBalance();
      const newBal = bal + amount;
      setBalance(newBal);
      return baseJson({ ok: true, balance: newBal, currency }, 200);
    }

    // If provider sends unknown method, answer with balance (safe)
    const bal = getBalance();
    return baseJson(
      { ok: true, balance: bal, currency, note: "Unknown method; returned balance" },
      200
    );
  } catch (e: any) {
    return baseJson({ ok: false, error: e?.message ?? String(e) }, 500);
  }
}
