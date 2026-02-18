import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";

function safeEq(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

function normalizeSig(sigRaw: string) {
  // Some providers prefix signatures with "sha256=".
  // Do NOT lowercase here because signature may be base64 (case-sensitive).
  return (sigRaw || "").replace(/^sha256=/i, "").trim();
}

function isHex64(s: string) {
  return /^[0-9a-fA-F]{64}$/.test(s);
}

export async function POST(req: NextRequest) {
  // 1) читаем raw body ровно один раз
  const raw = await req.text();

  // 2) signature header (поддерживаем разные имена)
  const sigHeader = (
    req.headers.get("x-signature") ||
    req.headers.get("X-Signature") ||
    req.headers.get("signature") ||
    req.headers.get("Signature") ||
    ""
  ).trim();

  const received = normalizeSig(sigHeader);

  // 3) PassimPay пишет, что других ключей нет — используем API KEY как secret.
  // Оставляем fallback на PASSIMPAY_SECRET на будущее.
  const secret = (
    process.env.PASSIMPAY_SECRET ||
    process.env.PASSIMPAY_API_KEY ||
    ""
  ).trim();

  const platformId = (process.env.PASSIMPAY_PLATFORM_ID || "").trim();

  if (!secret || !platformId) {
    console.log("[passimpay] missing env", { hasSecret: !!secret, platformId });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  if (!received) {
    console.log("[passimpay] missing signature header");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 4) Нормализуем JSON БЕЗ сортировки ключей.
  // Это убирает пробелы/переносы и приводит к типичному формату подписи провайдера.
  // (Сортировку ключей мы НЕ делаем.)
  let body: any = null;
  let jsonString = raw;
  try {
    body = JSON.parse(raw);
    jsonString = JSON.stringify(body);
  } catch {
    // Если пришло не JSON — подписываем raw
  }

  // По ТЗ поддержки: `${platformId};${json};${secret};`
  const signatureContract = `${platformId};${jsonString};${secret};`;

  // В логах PassimPay ты видишь HEX (64 символа), поэтому валидируем по hex.
  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(signatureContract, "utf8")
    .digest("hex")
    .toLowerCase();

  const receivedHex = isHex64(received) ? received.toLowerCase() : received;
  const ok = isHex64(receivedHex) && safeEq(receivedHex, expectedHex);

  if (!ok) {
    console.log("[passimpay] bad signature", {
      received,
      expectedHex,
      platformId,
      // Включай на 1 запрос, если нужно:
      // signatureContract,
      // raw,
      // jsonString,
    });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 5) Если body не распарсился выше — пробуем ещё раз (на случай не-JSON подписи)
  if (body == null) {
    try {
      body = JSON.parse(raw);
    } catch {
      console.log("[passimpay] invalid json");
      return NextResponse.json({ ok: false }, { status: 400 });
    }
  }

  console.log("[passimpay] webhook body:", body);

  // --- твоя логика ---
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

  if (tx.status === "done") return NextResponse.json({ ok: true });

  const isPaid =
    status === "paid" || status === "success" || status === "confirmed";
  if (!isPaid) {
    console.log("[passimpay] not paid yet:", status);
    return NextResponse.json({ ok: true });
  }

  const amount = Number(tx.amount);

  // Credit exactly the wallet currency of the transaction
  db.prepare(
    "UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND currency = ?"
  ).run(amount, tx.user_id, tx.currency);

  db.prepare("UPDATE transactions SET status = 'done' WHERE id = ?").run(tx.id);

  console.log("[passimpay] credited:", amount);
  return NextResponse.json({ ok: true });
}
