import crypto from "crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function normSig(s: string | null) {
  return (s || "").trim().replace(/^sha256=/i, "");
}
function isHex64(s: string) {
  return /^[a-f0-9]{64}$/i.test(s);
}
function sha256Hex(data: string) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}
function hmacHex(key: string, data: string) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest("hex");
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

type Candidate = { name: string; hex: string };

function buildCandidates(raw: string, compact: string, apiKey: string, platformId: string): Candidate[] {
  const bodies = [
    { tag: "raw", body: raw },
    { tag: "compact", body: compact },
  ];

  // 6 permutations of (body, apiKey, platformId)
  const orders: Array<{ n: string; f: (b: string) => string[] }> = [
    { n: "body+apiKey+platformId", f: (b) => [b, apiKey, platformId] },
    { n: "body+platformId+apiKey", f: (b) => [b, platformId, apiKey] },
    { n: "apiKey+body+platformId", f: (b) => [apiKey, b, platformId] },
    { n: "apiKey+platformId+body", f: (b) => [apiKey, platformId, b] },
    { n: "platformId+body+apiKey", f: (b) => [platformId, b, apiKey] },
    { n: "platformId+apiKey+body", f: (b) => [platformId, apiKey, b] },
  ];

  const seps = [
    { tag: "nosep", sep: "" },
    { tag: "semicolon", sep: ";" },
    { tag: "colon", sep: ":" },
    { tag: "pipe", sep: "|" },
  ];

  const out: Candidate[] = [];

  // SHA256 only-body variants
  for (const b of bodies) {
    out.push({ name: `sha256:${b.tag}:body`, hex: sha256Hex(b.body).toLowerCase() });
  }

  // SHA256 concatenations + separators
  for (const b of bodies) {
    for (const o of orders) {
      const parts = o.f(b.body);
      for (const s of seps) {
        const base = parts.join(s.sep);
        out.push({ name: `sha256:${b.tag}:${o.n}:${s.tag}`, hex: sha256Hex(base).toLowerCase() });
        // trailing separator (часто встречается)
        if (s.sep) out.push({ name: `sha256:${b.tag}:${o.n}:${s.tag}:trail`, hex: sha256Hex(base + s.sep).toLowerCase() });
      }
    }

    // “контракт с ;” из их старого сообщения (на всякий)
    out.push({
      name: `sha256:${b.tag}:platformId;json;apiKey;`,
      hex: sha256Hex(`${platformId};${b.body};${apiKey};`).toLowerCase(),
    });
  }

  // HMAC variants (если они всё-таки HMAC)
  const keys = [
    { tag: "key=apiKey", key: apiKey },
    { tag: "key=platformId", key: platformId },
    { tag: "key=apiKey+platformId", key: apiKey + platformId },
    { tag: "key=platformId+apiKey", key: platformId + apiKey },
  ];

  for (const k of keys) {
    for (const b of bodies) {
      // common HMAC data patterns
      const bases = [
        { n: "body", d: b.body },
        { n: "body+platformId", d: b.body + platformId },
        { n: "platformId+body", d: platformId + b.body },
        { n: "body+apiKey+platformId", d: b.body + apiKey + platformId },
        { n: "platformId;body;apiKey;", d: `${platformId};${b.body};${apiKey};` },
      ];
      for (const base of bases) {
        out.push({ name: `hmac:${k.tag}:${b.tag}:${base.n}`, hex: hmacHex(k.key, base.d).toLowerCase() });
      }
    }
  }

  return out;
}

export async function POST(req: Request) {
  try {
    const platformId = process.env.PASSIMPAY_PLATFORM_ID || "";
    const apiKey = process.env.PASSIMPAY_API_KEY || "";

    const receivedRaw = normSig(
      req.headers.get("x-signature") ||
        req.headers.get("signature") ||
        req.headers.get("x-sign") ||
        ""
    );

    // RAW body (байт-в-байт)
    const buf = Buffer.from(await req.arrayBuffer());
    const raw = buf.toString("utf8");

    let compact = raw;
    try {
      compact = JSON.stringify(JSON.parse(raw)); // НЕ сортировка, просто убираем пробелы
    } catch {}

    const receivedHex = receivedRaw.toLowerCase();
    const receivedLooksHex = isHex64(receivedHex);

    if (!receivedRaw || !receivedLooksHex) {
      console.log("[passimpay] missing/invalid signature header", { received: receivedRaw });
      return new NextResponse("bad signature", { status: 401 });
    }

    const candidates = buildCandidates(raw, compact, apiKey, platformId);

    const match = candidates.find((c) => safeEq(receivedHex, c.hex));

    if (!match) {
      // выводим top 25 вариантов, чтобы быстро увидеть, что они делают
      console.log("[passimpay] bad signature", {
        received: receivedHex,
        platformId,
        apiKeyLen: apiKey.length,
        samples: candidates.slice(0, 25),
      });
      return new NextResponse("bad signature", { status: 401 });
    }

    console.log("[passimpay] signature OK", match);

    // ===== подпись валидна — проводим зачисление =====
    const body = JSON.parse(raw);
    const db = getDb();

    const externalId =
      body.transaction_id ||
      body.transactionId ||
      body.id ||
      body.tx_id ||
      body.txId;

    if (!externalId) return NextResponse.json({ ok: true });

    const tx: any = db
      .prepare("SELECT * FROM transactions WHERE external_id = ?")
      .get(externalId);

    if (!tx) return NextResponse.json({ ok: true });
    if (tx.status === "done") return NextResponse.json({ ok: true });

    const status = (body.status || "").toString().toLowerCase();
    const isPaid =
      status === "paid" ||
      status === "success" ||
      status === "confirmed" ||
      status === "done";

    if (!isPaid) return NextResponse.json({ ok: true });

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
