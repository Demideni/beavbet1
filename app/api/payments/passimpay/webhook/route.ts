import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";

/**
 * Canonical JSON stringify with sorted keys (recursive),
 * so it matches "sortedBodyJson" from PassimPay docs.
 */
function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);

  if (value && typeof value === "object" && value.constructor === Object) {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalize(value[key]);
    }
    return out;
  }

  return value;
}

function canonicalJsonString(body: any): string {
  return JSON.stringify(canonicalize(body));
}

function safeEq(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    console.log("[passimpay] invalid json");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // ---- SIGNATURE VERIFY (PassimPay 방식) ----
  const signatureHeader = (req.headers.get("x-signature") || "").trim();

  // IMPORTANT: PassimPay secret = API key из кабинета (как тебе сказали)
  const secret = process.env.PASSIMPAY_API_KEY || "";
  const platformId = process.env.PASSIMPAY_PLATFORM_ID || ""; // добавь в Render env

  if (!secret || !platformId) {
    // чтобы ты сразу видел проблему по env (но не ломал прод)
    console.log("[passimpay] missing env", {
      hasSecret: !!secret,
      hasPlatformId: !!platformId,
    });
  }

  if (signatureHeader) {
    const sortedBodyJson = canonicalJsonString(body);
    const signatureContract = `${platformId}:${sortedBodyJson}`;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(signatureContract, "utf8")
      .digest("hex");

    const ok = safeEq(signatureHeader.toLowerCase(), expected.toLowerCase());

    if (!ok) {
      console.log("[passimpay] bad signature", {
        received: signatureHeader,
        expected,
        platformId,
      });
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }
  // ------------------------------------------

  const status = String(body.status ?? "").toLowerCase();
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

  const isPaid =
    status === "paid" || status === "success" || status === "confirmed";

  if (!isPaid) {
    console.log("[passimpay] not paid yet:", status);
    return NextResponse.json({ ok: true });
  }

  const amount = Number(tx.amount);

  db.prepare("UPDATE wallets SET balance = balance + ? WHERE user_id = ?").run(
    amount,
    tx.user_id
  );

  db.prepare("UPDATE transactions SET status = 'done' WHERE id = ?").run(tx.id);

  console.log("[passimpay] credited:", amount);

  return NextResponse.json({ ok: true });
}
