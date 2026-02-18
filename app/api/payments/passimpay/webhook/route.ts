import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";

// Deep-sort object keys to match PassimPay "sortedBodyJson"
function sortKeysDeep(value: any): any {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc: any, k) => {
        acc[k] = sortKeysDeep(value[k]);
        return acc;
      }, {});
  }
  return value;
}

export async function POST(req: NextRequest) {
  // Read raw body
  const raw = await req.text();

  // Parse body (needed for signature + business logic)
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch (e) {
    console.log("[passimpay] invalid json");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // --- Signature verification (per PassimPay docs) ---
  const signatureHeader = (req.headers.get("x-signature") || "").trim().toLowerCase();

  // PassimPay uses API key as SECRET in docs
  const secret = process.env.PASSIMPAY_API_KEY || "";
  if (!secret) {
    console.log("[passimpay] missing PASSIMPAY_API_KEY");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const platformId = body.platformId ?? body.platform_id;
  if (!platformId) {
    console.log("[passimpay] missing platformId in body");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // sortedBodyJson
  const sortedBody = sortKeysDeep(body);
  const sortedBodyJson = JSON.stringify(sortedBody);

  // signatureContract = PLATFORM_ID + ":" + sortedBodyJson
  const signatureContract = `${platformId}:${sortedBodyJson}`;

  // expected signature = hex(HMAC_SHA256(signatureContract, secret))
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signatureContract, "utf8")
    .digest("hex")
    .toLowerCase();

  if (signatureHeader && expected !== signatureHeader) {
    console.log("[passimpay] bad signature", {
      signatureHeader,
      expected,
      platformId,
      // signatureContract, // можно раскомментить для дебага, потом убрать
    });
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  // --- End signature verification ---

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

  const isPaid = status === "paid" || status === "success" || status === "confirmed";

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
