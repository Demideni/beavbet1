import crypto from "crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function normSig(s: string | null) {
  return (s || "").trim().replace(/^sha256=/i, "");
}

function sha256Hex(data: string) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(req: Request) {
  try {
    const platformId = process.env.PASSIMPAY_PLATFORM_ID || "";
    const apiKey = process.env.PASSIMPAY_API_KEY || "";

    if (!platformId || !apiKey) {
      return new NextResponse("config error", { status: 500 });
    }

    const received = normSig(
      req.headers.get("x-signature") ||
      req.headers.get("signature") ||
      ""
    ).toLowerCase();

    // Берём RAW body без изменений
    const raw = await req.text();

    // Поддержка сказала: подпись на основании body, apiKey, platformId
    const signatureBase = raw + apiKey + platformId;

    const expected = sha256Hex(signatureBase).toLowerCase();

    if (!safeEq(received, expected)) {
      console.log("[passimpay] bad signature", {
        received,
        expected,
      });
      return new NextResponse("bad signature", { status: 401 });
    }

    // ===== ПОДПИСЬ ВАЛИДНА =====

    const body = JSON.parse(raw);
    const db = getDb();

    const tx = db
      .prepare("SELECT * FROM transactions WHERE external_id = ?")
      .get(body.transaction_id);

    if (!tx) {
      return NextResponse.json({ ok: true });
    }

    if (tx.status === "done") {
      return NextResponse.json({ ok: true });
    }

    const status = body.status;
    const isPaid =
      status === "paid" ||
      status === "success" ||
      status === "confirmed";

    if (!isPaid) {
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
  } catch (err) {
    console.error("[passimpay] error", err);
    return new NextResponse("server error", { status: 500 });
  }
}
