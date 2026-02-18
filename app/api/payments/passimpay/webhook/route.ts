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
  const buf = Buffer.from(await req.arrayBuffer()); // <-- важно: байты, а не текст
  const raw = buf.toString("utf8");

  // Проверка подписи
  const signatureHeader = req.headers.get("x-signature") || "";
  const sig = signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();

  const secret = process.env.PASSIMPAY_API_KEY || "";

  // Считаем оба популярных варианта (hex и base64)
  const hmacHex = crypto.createHmac("sha256", secret).update(buf).digest("hex").toLowerCase();
  const hmacB64 = crypto.createHmac("sha256", secret).update(buf).digest("base64").trim().toLowerCase();

  if (sig) {
    const ok = safeEq(sig, hmacHex) || safeEq(sig, hmacB64);
    if (!ok) {
      console.log("[passimpay] bad signature", { signatureHeader, hmacHex, hmacB64 });
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
