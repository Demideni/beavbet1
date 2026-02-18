import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";

function safeEq(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

function canonicalSort(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(canonicalSort);

  const keys = Object.keys(obj).sort();
  const out: any = {};
  for (const k of keys) out[k] = canonicalSort(obj[k]);
  return out;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const body = JSON.parse(rawBody);

  const signatureHeaderRaw = (req.headers.get("x-signature") || "").trim();
  const signatureHeader = signatureHeaderRaw
    .replace(/^sha256=/i, "")
    .trim()
    .toLowerCase();

  const secret = (process.env.PASSIMPAY_API_KEY || "").trim();
  const platformId = (process.env.PASSIMPAY_PLATFORM_ID || "").trim();

  if (!secret || !platformId) {
    console.log("[passimpay] missing env vars");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // 🔥 КАНОНИЧЕСКИЙ JSON
  const sorted = canonicalSort(body);
  const sortedJson = JSON.stringify(sorted);

  // 🔥 ФОРМИРУЕМ signatureContract
  const signatureContract = `${platformId}:${sortedJson}`;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(signatureContract)
    .digest("hex")
    .toLowerCase();

  if (!safeEq(signatureHeader, expected)) {
    console.log("[passimpay] bad signature", {
      received: signatureHeader,
      expected,
      platformId,
    });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  console.log("[passimpay] signature valid");

  // === ДАЛЬШЕ ТВОЯ ЛОГИКА ПЛАТЕЖА ===

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

  if (!tx) return NextResponse.json({ ok: true });
  if (tx.status === "done") return NextResponse.json({ ok: true });

  const isPaid =
    status === "paid" ||
    status === "success" ||
    status === "confirmed";

  if (!isPaid) return NextResponse.json({ ok: true });

  const amount = Number(tx.amount);

  db.prepare(
    "UPDATE wallets SET balance = balance + ? WHERE user_id = ?"
  ).run(amount, tx.user_id);

  db.prepare(
    "UPDATE transactions SET status = 'done' WHERE id = ?"
  ).run(tx.id);

  console.log("[passimpay] credited:", amount);

  return NextResponse.json({ ok: true });
}
