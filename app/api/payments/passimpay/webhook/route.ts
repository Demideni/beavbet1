import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";

function stripPrefix(sig: string) {
  return (sig || "").trim().replace(/^sha256=/i, "");
}

function isHex64(s: string) {
  return /^[0-9a-fA-F]{64}$/.test(s);
}

function safeEq(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

function hmacHex(key: string, data: string) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest("hex");
}

function hmacB64(key: string, data: string) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest("base64");
}

function sha256Hex(data: string) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

export async function POST(req: NextRequest) {
  // --- read raw body exactly as received ---
  const buf = Buffer.from(await req.arrayBuffer());
  const rawBody = buf.toString("utf8");

  // --- signature header (support common variants) ---
  const sigHeaderRaw =
    req.headers.get("x-signature") ||
    req.headers.get("X-Signature") ||
    req.headers.get("signature") ||
    req.headers.get("Signature") ||
    "";

  const receivedRaw = stripPrefix(sigHeaderRaw);
  if (!receivedRaw) {
    console.log("[passimpay] missing signature header");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // According to PassimPay support: signature is formed based on body, apiKey, platformId
  // They did NOT specify the exact concatenation order/algorithm. To stop blocking deposits,
  // we validate against several common variants (HMAC-SHA256 and SHA256) without JSON sorting.
  const apiKey = (process.env.PASSIMPAY_API_KEY || "").trim();
  const platformId = (process.env.PASSIMPAY_PLATFORM_ID || "").trim();

  if (!apiKey || !platformId) {
    console.log("[passimpay] missing env", { hasApiKey: !!apiKey, platformId });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // IMPORTANT: no JSON sorting. We keep the body as-is.
  // But we also try a compact JSON form because some providers sign JSON.stringify(obj).
  let compactBody = rawBody;
  try {
    compactBody = JSON.stringify(JSON.parse(rawBody));
  } catch {
    // not JSON -> keep raw
  }

  const bases: Array<{ name: string; data: string }> = [
    { name: "raw+apiKey+platformId", data: rawBody + apiKey + platformId },
    { name: "raw+platformId+apiKey", data: rawBody + platformId + apiKey },
    { name: "platformId+raw+apiKey", data: platformId + rawBody + apiKey },
    { name: "platformId+apiKey+raw", data: platformId + apiKey + rawBody },

    { name: "compact+apiKey+platformId", data: compactBody + apiKey + platformId },
    { name: "compact+platformId+apiKey", data: compactBody + platformId + apiKey },
    { name: "platformId+compact+apiKey", data: platformId + compactBody + apiKey },
    { name: "platformId+apiKey+compact", data: platformId + apiKey + compactBody },

    // legacy variants some integrators use (with separators)
    { name: "platformId;raw;apiKey;", data: `${platformId};${rawBody};${apiKey};` },
    { name: "platformId;compact;apiKey;", data: `${platformId};${compactBody};${apiKey};` },
    { name: "platformId:raw:apiKey", data: `${platformId}:${rawBody}:${apiKey}` },
    { name: "platformId:compact:apiKey", data: `${platformId}:${compactBody}:${apiKey}` },
  ];

  const receivedIsHex = isHex64(receivedRaw);
  const receivedHex = receivedRaw.toLowerCase();

  let matched: { name: string; expected: string; algo: string } | null = null;

  for (const b of bases) {
    // HMAC variants (key = apiKey)
    const eh = hmacHex(apiKey, b.data).toLowerCase();
    const eb = hmacB64(apiKey, b.data).trim();

    if (receivedIsHex) {
      if (safeEq(receivedHex, eh)) {
        matched = { name: b.name, expected: eh, algo: "hmac-sha256-hex" };
        break;
      }
    } else {
      // base64 compare must be case-sensitive
      if (safeEq(receivedRaw, eb)) {
        matched = { name: b.name, expected: eb, algo: "hmac-sha256-base64" };
        break;
      }
    }

    // Plain SHA256 variants (some providers incorrectly call this a "signature")
    const sh = sha256Hex(b.data).toLowerCase();
    if (receivedIsHex && safeEq(receivedHex, sh)) {
      matched = { name: b.name, expected: sh, algo: "sha256-hex" };
      break;
    }
  }

  if (!matched) {
    // Log only a couple expected values to avoid flooding logs
    const sample = bases.slice(0, 3).map((b) => ({
      name: b.name,
      hmacHex: hmacHex(apiKey, b.data).toLowerCase(),
      sha256Hex: sha256Hex(b.data).toLowerCase(),
    }));

    console.log("[passimpay] bad signature", {
      received: receivedRaw,
      receivedLooksHex: receivedIsHex,
      platformId,
      sample,
    });

    return NextResponse.json({ ok: false }, { status: 401 });
  }

  console.log("[passimpay] signature OK", matched);

  // parse after signature OK
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.log("[passimpay] invalid json");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // --- existing business logic ---
  const status = String(body.status ?? "").toLowerCase();

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

  if (tx.status === "done") return NextResponse.json({ ok: true });

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
