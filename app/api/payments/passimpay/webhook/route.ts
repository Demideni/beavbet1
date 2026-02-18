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
    const received = normSig(
      req.headers.get("x-signature") ||
        req.headers.get("signature") ||
        req.headers.get("x-sign") ||
        ""
    ).toLowerCase();

    if (!received) {
      console.log("[passimpay] missing signature header");
      return new NextResponse("bad signature", { status: 401 });
    }

    // RAW body — как пришло
    const raw = await req.text();

    // ✅ Подпись = SHA256(body)
    const expected = crypto
      .createHash("sha256")
      .update(raw, "utf8")
      .digest("hex")
      .toLowerCase();

    if (!safeEq(received, expected)) {
      console.log("[passimpay] bad signature", {
        received,
        expected,
      });
      return new NextResponse("bad signature", { status: 401 });
    }

    // ===== подпись валидна =====
    const body = JSON.parse(raw);
    const db = getDb();

    // transaction id (под разные возможные поля)
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

    // ищем транзакцию у нас
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

    // зачисляем баланс
    db.prepare("UPDATE wallets SET balance = balance + ? WHERE user_id = ?").run(
      amount,
      tx.user_id
    );

    // отмечаем транзакцию выполненной
    db.prepare("UPDATE transactions SET status = 'done' WHERE id = ?").run(tx.id);

    console.log("[passimpay] credited:", { userId: tx.user_id, amount });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[passimpay] error", err);
    return new NextResponse("server error", { status: 500 });
  }
}
