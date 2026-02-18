import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPassimpaySignatureFromRaw } from "@/lib/passimpay";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const platformId = (process.env.PASSIMPAY_PLATFORM_ID || "").trim();
  const secret = (process.env.PASSIMPAY_API_KEY || "").trim();

  if (!platformId || !secret) {
    return NextResponse.json(
      { ok: false, error: "PASSIMPAY_PLATFORM_ID/PASSIMPAY_API_KEY is not set" },
      { status: 500 }
    );
  }

  const signature = req.headers.get("x-signature") || req.headers.get("X-Signature") || "";

  // IMPORTANT: verify against RAW JSON string, not re-serialized object
  const raw = await req.text().catch(() => "");
  if (!raw) return NextResponse.json({ ok: false, error: "empty_body" }, { status: 400 });

  let body: any = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!verifyPassimpaySignatureFromRaw(platformId, raw, secret, signature)) {
    // Keep ack=401 so Passimpay retries (helps debugging)
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
  }

  // PassimPay may send different "type" values depending on product/config.
  // We'll log and try to resolve the transaction by multiple identifiers.
  const eventType = String(body.type ?? "").toLowerCase();

  // Collect possible identifiers PassimPay might send
  const ids = new Set<string>();
  const add = (v: any) => {
    if (!v) return;
    const s = String(v).trim();
    if (s) ids.add(s);
  };

  add(body.orderId); add(body.order_id);
  add(body.paymentId); add(body.payment_id);
  add(body.invoiceId); add(body.invoice_id);
  add(body.id); add(body.transactionId); add(body.transaction_id);
  add(body.providerRef); add(body.provider_ref);

  // Render logs don't show request bodies unless we log them ourselves.
  // IMPORTANT: do not log secrets; logging webhook payload is OK for debugging.
  console.log("[passimpay:webhook] type=", eventType, "status=", status, "ids=", Array.from(ids));
  console.log("[passimpay:webhook] raw=", raw);

  if (ids.size === 0) {
    console.log("[passimpay:webhook] no identifiers in payload; ack");
    return NextResponse.json({ ok: true });
  }

  const db = getDb();

  // Try to find tx by order_id first, then by provider_ref
  let tx: any = null;
  for (const id of ids) {
    tx =
      (db
        .prepare(`SELECT * FROM transactions WHERE order_id = ? AND provider = 'passimpay' LIMIT 1`)
        .get(id) as any) ||
      (db
        .prepare(`SELECT * FROM transactions WHERE provider_ref = ? AND provider = 'passimpay' LIMIT 1`)
        .get(id) as any);
    if (tx) break;
  }

  if (!tx) {
    console.log("[passimpay:webhook] transaction not found; ack");
    return NextResponse.json({ ok: true });
  }

  // idempotency: already processed
  if (tx.status === "done" || tx.status === "paid") return NextResponse.json({ ok: true });

  // Some providers send confirmations, some send status only.
  const confirmations = Number(body.confirmations ?? 0);
  const minConfirmations = 1;

  const paidAmount = Number(body.amountReceive ?? body.amount ?? tx.amount);

  // Update transaction meta with latest webhook (keep history)
  const meta = (() => {
    try {
      return tx.meta ? JSON.parse(tx.meta) : {};
    } catch {
      return {};
    }
  })();
  const hooks = Array.isArray(meta.webhooks) ? meta.webhooks : [];
  hooks.push({ at: Date.now(), body });
  meta.webhooks = hooks;

  const now = Date.now();
  db.prepare(`UPDATE transactions SET meta = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(meta), now, tx.id);

  // If webhook uses confirmations model - wait for it.
  // If webhook uses status model - credit on paid/success.
  const isPaidByStatus = status === "paid" || status === "success" || status === "completed";
  if (!isPaidByStatus && confirmations < minConfirmations) {
    console.log("[passimpay:webhook] tx", tx.id, "still not paid. status=", status, "confirmations=", confirmations);
    return NextResponse.json({ ok: true });
  }

  // Ensure wallet exists
  const { randomUUID } = await import("node:crypto");
  db.prepare(
    `INSERT OR IGNORE INTO wallets (id, user_id, currency, balance, created_at)
     VALUES (?, ?, ?, 0, ?)`
  ).run(randomUUID(), tx.user_id, tx.currency, now);

  console.log("[passimpay:webhook] crediting tx", tx.id, "user", tx.user_id, "amount", paidAmount, tx.currency);

  // Credit wallet once
  db.prepare(`UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND currency = ?`).run(
    paidAmount,
    tx.user_id,
    tx.currency
  );

  // Mark transaction done
  db.prepare(`UPDATE transactions SET status = 'done', updated_at = ? WHERE id = ?`).run(now, tx.id);

  return NextResponse.json({ ok: true });
}
