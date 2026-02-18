import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";

function safeEq(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

export async function POST(req: NextRequest) {
  // 1) Берём СЫРОЙ body как байты (важно)
  const buf = Buffer.from(await req.arrayBuffer());
  const rawJson = buf.toString("utf8"); // <-- это body "как пришёл"

  // 2) Заголовок подписи
  const signatureHeaderRaw = (req.headers.get("x-signature") || "").trim();
  const received = signatureHeaderRaw.replace(/^sha256=/i, "").trim().toLowerCase();

  // 3) Env
  const secret = (process.env.PASSIMPAY_API_KEY || "").trim(); // у тебя так назван, ок
  const platformId = (process.env.PASSIMPAY_PLATFORM_ID || "").trim();

  if (!secret || !platformId) {
    console.log("[passimpay] missing env", {
      hasSecret: Boolean(secret),
      platformId,
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // ✅ 4) ВАЖНО: signatureContract теперь включает secret
  // Было: `${platformId}:${sortedJson}`
  // Стало: `${platformId}:${rawJson}:${secret}`
  const signatureContract = `${platformId}:${rawJson}:${secret}`;

  // 5) Считаем подпись (как в доке: HMAC-SHA256 по contract, ключ = secret)
  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(signatureContract, "utf8")
    .digest("hex")
    .toLowerCase();

  // Иногда провайдеры шлют base64 — оставим на всякий случай
  const expectedB64 = crypto
    .createHmac("sha256", secret)
    .update(signatureContract, "utf8")
    .digest("base64")
    .trim()
    .toLowerCase();

  if (received) {
    const ok = safeEq(received, expectedHex) || safeEq(received, expectedB64);
    if (!ok) {
      console.log("[passimpay] bad signature", {
        received,
        expectedHex,
        expectedB64,
        platformId,
      });
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  } else {
    console.log("[passimpay] missing x-signature header");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 6) Только после проверки подписи парсим JSON
  let body: any;
  try {
    body = JSON.parse(rawJson);
  } catch (e) {
    console.log("[passimpay] invalid json");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  console.log("[passimpay] webhook body:", body);

  // --------- дальше твоя бизнес-логика (как было) ---------

  const status = String(body.status ?? "").toLowerCase();

  const possibleIds = [
    body.orderId,
    body.order_id,
    body.paymentId,
    body.payment_id,
    body.invoiceId,
    body.invoice_id,
    body.id,
  ].filter(Boolean);

  if (!possibleIds.length) {
    console.log("[passimpay] no identifiers");
    return NextResponse.json({ ok: true });
  }

  const db = getDb();
  let tx: any = null;

  for (const id of possibleIds) {
    tx = db
      .prepare(
        "SELECT * FROM transactions WHERE provider = 'passimpay' AND order_id = ? LIMIT 1"
      )
      .get(String(id));

    if (tx) break;
  }

  if (!tx) {
    console.log("[passimpay] transaction not found");
    return NextResponse.json({ ok: true });
  }

  if (tx.status === "done") {
    return NextResponse.json({ ok: true });
  }

  const isPaid =
    status === "paid" ||
    status === "success" ||
    status === "confirmed";

  if (!isPaid) {
    console.log("[passimpay] not paid yet:", status);
    return NextResponse.json({ ok: true });
  }

  const amount = Number(tx.amount);

  db.prepare("UPDATE wallets SET balance = balance + ? WHERE user_id = ?")
    .run(amount, tx.user_id);

  db.prepare("UPDATE transactions SET status = 'done' WHERE id = ?")
    .run(tx.id);

  console.log("[passimpay] credited:", amount);

  return NextResponse.json({ ok: true });
}
