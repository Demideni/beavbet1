import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";

function safeEq(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

function hmacHex(secret: string, data: string | Buffer) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex").toLowerCase();
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
  const buf = Buffer.from(await req.arrayBuffer());
  const raw = buf.toString("utf8");

  const signatureHeaderRaw = (req.headers.get("x-signature") || "").trim();
  const signatureHeader = signatureHeaderRaw.replace(/^sha256=/i, "").trim().toLowerCase();

  const secret = (process.env.PASSIMPAY_API_KEY || "").trim();
  const platformIdEnv = (process.env.PASSIMPAY_PLATFORM_ID || "").trim();

  // сначала парсим body, чтобы дальше использовать в логике платежа
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    console.log("[passimpay] invalid json");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // platformId для подписи: приоритет ENV, иначе из body
  const platformId = platformIdEnv || String(body?.platformId ?? "");

  if (signatureHeader) {
    // Варианты "контракта" — т.к. у провайдеров часто расходится каноникализация
    const jsonMinified = JSON.stringify(JSON.parse(raw)); // minify как JS
    const jsonSorted = JSON.stringify(canonicalSort(body)); // сортировка ключей

    const candidates = [
      // 1) как в доке: PLATFORM_ID + ":" + json (minified)
      `${platformId}:${jsonMinified}`,
      // 2) PLATFORM_ID + ":" + jsonSorted
      `${platformId}:${jsonSorted}`,
      // 3) PLATFORM_ID + ":" + raw как пришло
      `${platformId}:${raw}`,
      // 4) иногда без platformId (на всякий)
      jsonMinified,
      jsonSorted,
      raw,
    ];

    const expectedList = candidates.map((c) => hmacHex(secret, c));

    const ok = expectedList.some((exp) => safeEq(signatureHeader, exp));

    if (!ok) {
      // логируем только хеши и platformId (без секрета)
      console.log("[passimpay] bad signature", {
        platformId,
        received: signatureHeader,
        expectedTop3: expectedList.slice(0, 3),
      });
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  // ===== дальше твоя бизнес-логика без изменений =====

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
