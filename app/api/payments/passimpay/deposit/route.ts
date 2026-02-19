import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { passimpaySignature } from "@/lib/passimpay";

export const runtime = "nodejs";

const Schema = z.object({
  amount: z.number().finite().positive().max(1000000),
  currency: z.enum(["USD", "EUR", "USDT", "BTC"]).default("EUR"),
});

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  // IMPORTANT:
  // - platformId в body лучше отправлять числом
  // - подпись должна считаться по ТОЧНО той же строке body, которую мы отправляем
  const platformIdRaw = (process.env.PASSIMPAY_PLATFORM_ID || "").trim();
  const platformId = Number(platformIdRaw);
  const secret = (process.env.PASSIMPAY_API_KEY || "").trim();
  const baseUrl = (process.env.PASSIMPAY_BASE_URL || "https://api.passimpay.io")
    .trim()
    .replace(/\/$/, "");

  if (!platformIdRaw || !Number.isFinite(platformId) || !secret || !baseUrl) {
    console.error("[passimpay][deposit] missing/invalid env", {
      platformIdRaw,
      platformId,
      hasSecret: !!secret,
      baseUrl,
    });
    return NextResponse.json({ ok: false, error: "PASSIMPAY_NOT_CONFIGURED" }, { status: 500 });
  }

  const { amount, currency } = parsed.data;

  // Ensure wallet exists now (so UI can show it) but DO NOT credit here
  const db = getDb();
  const now = Date.now();

  const w = db
    .prepare("SELECT id FROM wallets WHERE user_id = ? AND currency = ?")
    .get(session.id, currency) as { id: string } | undefined;

  if (!w) {
    db.prepare("INSERT INTO wallets (id, user_id, currency, balance, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(randomUUID(), session.id, currency, 0, now);
  }

  const orderId = randomUUID();

  const callbackUrl = `${
    process.env.NEXT_PUBLIC_APP_URL || "https://www.beavbet.com"
  }/api/payments/passimpay/webhook`;

  // Формат под /api/createorder (не /v2/createorder)
  const body = {
    orderId,
    platformId,
    paymentType: "crypto",
    type: "deposit",
    currency,
    // строкой с 2 знаками — чаще всего так ожидают
    amount: amount.toFixed(2),
    callbackUrl,
  } as const;

  const bodyStr = JSON.stringify(body);
  const signature = passimpaySignature(platformIdRaw, bodyStr, secret);

  const r = await fetch(`${baseUrl}/api/createorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-signature": signature,
    },
    body: bodyStr,
    cache: "no-store",
  });

  const data = await r.json().catch(() => null);

  // Поддержим оба формата ответа (у них встречаются разные)
  const paymentUrl = data?.data?.paymentPageUrl || data?.url;
  const paymentId = data?.data?.paymentId ?? data?.paymentId ?? null;

  if (!r.ok || !paymentUrl) {
    console.error("[passimpay][deposit] createorder failed", { status: r.status, details: data });
    return NextResponse.json({ ok: false, error: "PASSIMPAY_ERROR", details: data }, { status: 400 });
  }

  // Save a pending transaction
  const txId = randomUUID();
  db.prepare(
    "INSERT INTO transactions (id, user_id, type, amount, currency, status, created_at, meta, provider, provider_ref, order_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    txId,
    session.id,
    "deposit",
    amount,
    currency,
    "pending",
    now,
    JSON.stringify({ passimpay: { url: paymentUrl, response: data } }),
    "passimpay",
    paymentId,
    orderId,
    now
  );

  return NextResponse.json({ ok: true, url: paymentUrl, orderId });
}
