import crypto from "crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function normSig(s: string | null) {
  return (s || "").trim().replace(/^sha256=/i, "");
}

function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

export async function POST(req: Request) {
  try {
    const platformId = process.env.PASSIMPAY_PLATFORM_ID || "";
    const apiKey = process.env.PASSIMPAY_API_KEY || "";

    const received = normSig(
      req.headers.get("x-signature") ||
        req.headers.get("signature") ||
        req.headers.get("x-sign") ||
        ""
    ).toLowerCase();

    if (!platformId || !apiKey) {
      console.log("[passimpay] missing env vars", {
        hasPlatformId: !!platformId,
        hasApiKey: !!apiKey,
      });
      return new NextResponse("config error", { status: 500 });
    }

    if (!received) {
      console.log("[passimpay] missing signature header");
      return new NextResponse("bad signature", { status: 401 });
    }

    // ✅ Берём raw body как строку, БЕЗ JSON.stringify и БЕЗ сортировки
    const bodyStr = await req.text();

    // ✅ Официальный контракт от PassimPay:
    // `${platformId};${bodyStr};${apiKey}`
    const signatureContract = `${platformId};${bodyStr};${apiKey}`;

    // ✅ expected = HMAC_SHA256(apiKey, signatureContract).hexLower()
    const expected = crypto
      .createHmac("sha256", apiKey)
      .update(signatureContract, "utf8")
      .digest("hex")
      .toLowerCase();

    if (!safeEq(received, expected)) {
      console.log("[passimpay] bad signature", {
        received,
        expected,
        platformId,
        // на время дебага можно раскомментить:
        // signatureContract,
        // bodyStr,
      });
      return new NextResponse("bad signature", { status: 401 });
    }

    // ===== подпись валидна =====
    const body = JSON.parse(bodyStr);
    const db = getDb();

    const externalId =
      body.transaction_id ||
      body.transactionId ||
      body.id ||
      body.tx_id ||
      body.txId;

    if (!externalId) {
      console.log("[passimpay] no transaction id in body");
      return NextResponse.json({ ok: true });
    }

    const tx: any = db
      .prepare("SELECT * FROM transactions WHERE external_id = ?")
      .get(externalId);

    if (!tx) {
      console.log("[passimpay] tx not found:", externalId);
      return NextResponse.json({ ok: true });
    }

    if (tx.status === "done") {
      return NextResponse.json({ ok: true });
    }

    const status = (body.status || "").toString().toLowerCase();
    const isPaid =
      status === "paid" ||
      status === "success" ||
      status === "confirmed" ||
      status === "done";

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

    console.log("[passimpay] credited:", { userId: tx.user_id, amount });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[passimpay] error", err);
    return new NextResponse("server error", { status: 500 });
  }
}
