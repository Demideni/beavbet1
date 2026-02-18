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
    const apiKey = process.env.PASSIMPAY_API_KEY || "";

    const received = normSig(
      req.headers.get("x-signature") ||
      req.headers.get("signature") ||
      ""
    ).toLowerCase();

    if (!received) {
      return new NextResponse("bad signature", { status: 401 });
    }

    // получаем тело как БАЙТЫ
    const bodyBuf = Buffer.from(await req.arrayBuffer());
    const bodyStr = bodyBuf.toString("utf8");

    // 🔥 КЛЮЧЕВОЕ:
    // sha256(body + apiKey)
    const expected = crypto
      .createHash("sha256")
      .update(bodyStr + apiKey, "utf8")
      .digest("hex")
      .toLowerCase();

    if (!safeEq(received, expected)) {
      console.log("[passimpay] bad signature", {
        received,
        expected
      });
      return new NextResponse("bad signature", { status: 401 });
    }

    const body = JSON.parse(bodyStr);
    const db = getDb();

    const externalId =
      body.transaction_id ||
      body.transactionId ||
      body.id;

    if (!externalId) {
      return NextResponse.json({ ok: true });
    }

    const tx: any = db
      .prepare("SELECT * FROM transactions WHERE external_id = ?")
      .get(externalId);

    if (!tx) {
      return NextResponse.json({ ok: true });
    }

    if (tx.status === "done") {
      return NextResponse.json({ ok: true });
    }

    const status = (body.status || "").toLowerCase();
    const isPaid =
      status === "paid" ||
      status === "success" ||
      status === "confirmed" ||
      status === "done";

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
