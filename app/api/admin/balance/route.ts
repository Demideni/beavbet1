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

function walletsHasUpdatedAt(db: any) {
  try {
    const cols = db.prepare("PRAGMA table_info(wallets)").all() as Array<{ name: string }>;
    return cols.some((c) => c.name === "updated_at");
  } catch {
    return false;
  }
}

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
  // Store timestamps in seconds (more consistent across the project)
  const now = Math.floor(Date.now() / 1000);
  const hasUpdatedAt = walletsHasUpdatedAt(db);

  // ✅ Prevent FK crashes: make sure the user exists in *this* database.
  const userExists = db
    .prepare("SELECT 1 AS ok FROM users WHERE id = ?")
    .get(userId) as { ok: 1 } | undefined;
  if (!userExists) {
    return NextResponse.json(
      { ok: false, error: "USER_NOT_FOUND" },
      { status: 404 }
    );
  }

  // Ensure wallet exists (support older/newer schemas)
  const w = db
    .prepare("SELECT id, balance FROM wallets WHERE user_id = ? AND currency = ?")
    .get(userId, currency) as { id: string; balance: number } | undefined;

  if (!w) {
    if (hasUpdatedAt) {
      db.prepare(
        "INSERT INTO wallets (id, user_id, currency, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(randomUUID(), userId, currency, 0, now, now);
    } else {
      db.prepare(
        "INSERT INTO wallets (id, user_id, currency, balance, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run(randomUUID(), userId, currency, 0, now);
    }
  }

  // Apply update atomically
  const txId = randomUUID();
  const auditId = randomUUID();
  const trx = db.transaction(() => {
    if (hasUpdatedAt) {
      db.prepare(
        "UPDATE wallets SET balance = balance + ?, updated_at = ? WHERE user_id = ? AND currency = ?"
      ).run(amount, now, userId, currency);
    } else {
      db.prepare("UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND currency = ?").run(
        amount,
        userId,
        currency
      );
    }

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

  try {
    trx();
  } catch (e: any) {
    // Return a clearer error to the admin UI instead of a 500 without context.
    const code = e?.code || e?.name || "SQLITE_ERROR";
    const message = String(e?.message || e);
    return NextResponse.json(
      { ok: false, error: "DB_ERROR", code, message },
      { status: 500 }
    );
  }

  const updated = db
    .prepare("SELECT currency, balance FROM wallets WHERE user_id = ? AND currency = ?")
    .get(userId, currency) as { currency: string; balance: number };

  return NextResponse.json({ ok: true, wallet: updated, txId });
}
