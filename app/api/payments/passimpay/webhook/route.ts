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
  return sigRaw.replace(/^sha256=/i, "").trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  // raw bytes (важно)
  const buf = Buffer.from(await req.arrayBuffer());
  const rawJson = buf.toString("utf8");

  // header: поддерживаем оба варианта имени
  const sigHeader =
    (req.headers.get("x-signature") ||
      req.headers.get("X-Signature") ||
      "").trim();

  const received = normalizeSig(sigHeader);

  const secret = (process.env.PASSIMPAY_API_KEY || "").trim();
  const platformId = (process.env.PASSIMPAY_PLATFORM_ID || "").trim();

  if (!secret || !platformId) {
    console.log("[passimpay] missing env", { hasSecret: !!secret, platformId });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // ✅ как сказал их интегратор:
  // `${platformId}:${rawJson}:${secret}`
  const signatureContract = `${platformId}:${rawJson}:${secret}`;

  // HMAC-SHA256 (key=secret, data=signatureContract)
  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(signatureContract, "utf8")
    .digest("hex")
    .toLowerCase();

  const expectedB64 = crypto
    .createHmac("sha256", secret)
    .update(signatureContract, "utf8")
    .digest("base64")
    .trim()
    .toLowerCase();

  if (!received) {
    console.log("[passimpay] missing signature header");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

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

  // parse after signature OK
  let body: any;
  try {
    body = JSON.parse(rawJson);
  } catch {
    console.log("[passimpay] invalid json");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  console.log("[passimpay] webhook body:", body);

  // --- твоя логика как была ---
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

  const isPaid = status === "paid" || status === "success" || status === "confirmed";
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
