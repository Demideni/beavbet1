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
  const buf = Buffer.from(await req.arrayBuffer());
  const raw = buf.toString("utf8");

  const signatureHeader = (req.headers.get("x-signature") || "").trim();
  const secret = process.env.PASSIMPAY_API_KEY || "";

  if (!secret) {
    console.log("[passimpay] missing PASSIMPAY_API_KEY");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // PassimPay signs EXACT raw body using HMAC-SHA256 and returns HEX
  const expected = crypto
    .createHmac("sha256", secret)
    .update(raw, "utf8")
    .digest("hex")
    .toLowerCase();

  const received = signatureHeader.replace(/^sha256=/i, "").toLowerCase();

  if (!safeEq(received, expected)) {
    console.log("[passimpay] bad signature", {
      received,
      expected,
    });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = JSON.parse(raw);
  console.log("[passimpay] webhook body:", body);

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

  const type = String(body.type ?? "").toLowerCase();
  const confirmations = Number(body.confirmations ?? 0);

  // PassimPay sends deposit webhook on confirmations
  const isPaid =
    type === "deposit" &&
    confirmations >= 1;

  if (!isPaid) {
    console.log("[passimpay] not confirmed yet:", { type, confirmations });
    return NextResponse.json({ ok: true });
  }

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
