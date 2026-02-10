import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { gaInit, gaCurrency } from "@/lib/gaClient";
import { getDb, uuid } from "@/lib/db";

export const runtime = "nodejs";

const Body = z.object({
  game_uuid: z.string().min(1),
  is_mobile: z.boolean().optional(),
});

function baseUrlFromEnv() {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://beavbet.com"
  ).replace(/\/$/, "");
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = Body.parse(await req.json());
    const db = getDb();

    // --- ensure tables exist (NO updated_at anywhere) ---
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

    const sessionId = uuid();

    db.prepare(`
      INSERT INTO ga_sessions (session_id, user_id, created_at)
      VALUES (?, ?, ?)
    `).run(sessionId, user.id, Date.now());

    const currency = gaCurrency(); // provider test expects EUR
    const baseUrl = baseUrlFromEnv();
    const returnUrl = `${baseUrl}/casino?ga=return`;

    // If wallet row doesn't exist, create it (balance may be seeded separately)
    const existing = db.prepare(`
      SELECT balance FROM wallets WHERE user_id = ? AND currency = ?
    `).get(user.id, currency) as { balance: number } | undefined;

    if (!existing) {
      db.prepare(`
        INSERT INTO wallets (user_id, currency, balance)
        VALUES (?, ?, ?)
      `).run(user.id, currency, 0);
    }

    // Optional: seed test balance for EUR so slots are not disabled
    // (If you already credit via Passimpay, you can set GA_SEED_EUR=0)
    const seed = Number(process.env.GA_SEED_EUR ?? "50");
    if (seed > 0) {
      // Only seed if current is 0 to avoid infinite top-ups
      const row = db.prepare(`
        SELECT balance FROM wallets WHERE user_id = ? AND currency = ?
      `).get(user.id, currency) as { balance: number } | undefined;

      if (row && Number(row.balance) <= 0) {
        db.prepare(`
          UPDATE wallets
          SET balance = ?
          WHERE user_id = ? AND currency = ?
        `).run(seed, user.id, currency);
      }
    }

    const resp = await gaInit({
      game_uuid: body.game_uuid,
      user_id: String(user.id),
      session_id: sessionId,
      return_url: returnUrl,
      currency,
      language: "ru",
      is_mobile: !!body.is_mobile,
    });

    const url =
      (resp as any)?.url ||
      (resp as any)?.data?.url ||
      (resp as any)?.game_url ||
      (resp as any)?.data?.game_url;

    if (!url) {
      return NextResponse.json(
        { ok: false, error: "No url in GA init response", resp },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, url, sessionId, currency }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
