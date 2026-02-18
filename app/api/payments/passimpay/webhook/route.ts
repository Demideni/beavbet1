import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Проверка подписи
  const signature = req.headers.get("x-signature");
  const secret = process.env.PASSIMPAY_API_KEY || "";

  if (signature) {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(raw)
      .digest("hex");

    if (expected !== signature) {
      console.log("[passimpay] bad signature");
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const body = JSON.parse(raw);

  const status = String(body.status ?? "").toLowerCase();

  console.log("[passimpay] webhook body:", body);

  // Собираем возможные ID
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

  db.prepare(
    "UPDATE wallets SET balance = balance + ? WHERE user_id = ?"
  ).run(amount, tx.user_id);

  db.prepare(
    "UPDATE transactions SET status = 'done' WHERE id = ?"
  ).run(tx.id);

  console.log("[passimpay] credited:", amount);

  return NextResponse.json({ ok: true });
}
