import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID, createHmac } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

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

  const platformId = (process.env.PASSIMPAY_PLATFORM_ID || "").trim();
  const apiKey = (process.env.PASSIMPAY_API_KEY || "").trim(); // у PassimPay это key/secret
  const baseUrl = (process.env.PASSIMPAY_BASE_URL || "https://api.passimpay.io").trim();

  if (!platformId || !apiKey) {
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
    db.prepare("INSERT INTO wallets (id, user_id, currency, balance, created_at) VALUES (?, ?, ?, ?, ?)").run(
      randomUUID(),
      session.id,
      currency,
      0,
      now
    );
  }

  const orderId = randomUUID();

  // ВАЖНО: bodyStr — это EXACT JSON, который отправляем в PassimPay
  // По инструкции PassimPay: signatureContract = `${platformId};${bodyStr};${apiKey}`
  const bodyObj = {
    orderId,
    amount: amount.toFixed(2),
    symbol: currency,
  };

  const bodyStr = JSON.stringify(bodyObj);
  const signatureContract = `${platformId};${bodyStr};${apiKey}`;

  const signature = createHmac("sha256", apiKey)
    .update(signatureContract, "utf8")
    .digest("hex")
    .toLowerCase();

  const r = await fetch(`${baseUrl}/v2/createorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-platform-id": platformId,
      "x-signature": signature,
    },
    body: bodyStr,
    cache: "no-store",
  });

  const data = await r.json().catch(() => null);

  if (!r.ok || !data?.url) {
    console.error("[passimpay][deposit] createorder failed", {
      status: r.status,
      details: data,
      // если надо прям дожать — можно временно раскомментить:
      // bodyStr,
      // signatureContract,
      // signature,
    });

    return NextResponse.json(
      { ok: false, error: "PASSIMPAY_ERROR", status: r.status, details: data },
      { status: 400 }
    );
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
    JSON.stringify({ passimpay: { url: data.url, response: data } }),
    "passimpay",
    data.paymentId ?? null,
    orderId,
    now
  );

  return NextResponse.json({ ok: true, url: data.url, orderId });
}
