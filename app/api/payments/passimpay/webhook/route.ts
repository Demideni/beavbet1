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

type SigMatch = { algo: "sha256" | "hmac"; variant: string; expected: string };

function buildCandidates(raw: string, compact: string, apiKey: string, platformId: string) {
  const bodies = [
    { tag: "raw", body: raw },
    { tag: "compact", body: compact },
  ];

  // 6 permutations of (body, apiKey, platformId)
  const orders: Array<{ name: string; parts: (b: string) => string[] }> = [
    { name: "body+apiKey+platformId", parts: (b) => [b, apiKey, platformId] },
    { name: "body+platformId+apiKey", parts: (b) => [b, platformId, apiKey] },
    { name: "apiKey+body+platformId", parts: (b) => [apiKey, b, platformId] },
    { name: "apiKey+platformId+body", parts: (b) => [apiKey, platformId, b] },
    { name: "platformId+body+apiKey", parts: (b) => [platformId, b, apiKey] },
    { name: "platformId+apiKey+body", parts: (b) => [platformId, apiKey, b] },
  ];

  const seps = [
    { tag: "no-sep", join: "" },
    { tag: "semicolon", join: ";" },
    { tag: "colon", join: ":" },
    { tag: "pipe", join: "|" },
  ];

  const dataVariants: Array<{ name: string; data: string }> = [];

  for (const b of bodies) {
    for (const o of orders) {
      const parts = o.parts(b.body);

      // without separators
      dataVariants.push({
        name: `${b.tag}:${o.name}:${seps[0].tag}`,
        data: parts.join(""),
      });

      // with separators (+ optional trailing ;)
      for (const s of seps.slice(1)) {
        dataVariants.push({
          name: `${b.tag}:${o.name}:${s.tag}`,
          data: parts.join(s.join),
        });
        dataVariants.push({
          name: `${b.tag}:${o.name}:${s.tag}:trail`,
          data: parts.join(s.join) + s.join,
        });
      }
    }

    // “старый” контракт из их раннего сообщения (на всякий случай)
    dataVariants.push({
      name: `${b.tag}:platformId;json;secret;`,
      data: `${platformId};${b.body};${apiKey};`,
    });
  }

  return dataVariants;
}

export async function POST(req: Request) {
  try {
    const platformId = process.env.PASSIMPAY_PLATFORM_ID || "";
    const apiKey = process.env.PASSIMPAY_API_KEY || "";

    if (!platformId || !apiKey) {
      console.log("[passimpay] missing env vars");
      return new NextResponse("config error", { status: 500 });
    }

    const receivedRaw = normSig(
      req.headers.get("x-signature") ||
        req.headers.get("signature") ||
        req.headers.get("x-sign") ||
        ""
    );

    if (!receivedRaw) {
      console.log("[passimpay] missing signature header");
      return new NextResponse("bad signature", { status: 401 });
    }

    // Read RAW body
    const raw = await req.text();

    // Compact JSON (no spaces) – NOT sorting, just normalization
    let compact = raw;
    try {
      compact = JSON.stringify(JSON.parse(raw));
    } catch {
      // ignore
    }

    const receivedIsHex = isHex64(receivedRaw);
    const receivedHex = receivedRaw.toLowerCase();

    const variants = buildCandidates(raw, compact, apiKey, platformId);

    let matched: SigMatch | null = null;

    // 1) Try SHA256(hex)
    if (receivedIsHex) {
      for (const v of variants) {
        const expected = sha256Hex(v.data).toLowerCase();
        if (safeEq(receivedHex, expected)) {
          matched = { algo: "sha256", variant: v.name, expected };
          break;
        }
      }
    }

    // 2) Try HMAC-SHA256(hex) as fallback (some vendors say “based on” but actually HMAC)
    if (!matched && receivedIsHex) {
      for (const v of variants) {
        const expected = hmacHex(apiKey, v.data).toLowerCase();
        if (safeEq(receivedHex, expected)) {
          matched = { algo: "hmac", variant: v.name, expected };
          break;
        }
      }
    }

    if (!matched) {
      // For debugging: log a small sample, not the whole body
      const sample = variants.slice(0, 6).map((v) => ({
        variant: v.name,
        sha256: sha256Hex(v.data).toLowerCase(),
        hmac: hmacHex(apiKey, v.data).toLowerCase(),
      }));

      console.log("[passimpay] bad signature", {
        received: receivedRaw,
        platformId,
        sample,
      });

      return new NextResponse("bad signature", { status: 401 });
    }

    console.log("[passimpay] signature OK", matched);

    // ===== Signature valid: process payment =====
    const body = JSON.parse(raw);

    const db = getDb();

    // We expect your DB has transactions.external_id matching body.transaction_id
    const externalId = body.transaction_id || body.transactionId || body.id;
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

    // accept multiple "paid" statuses (your old code did this)
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

    // credit wallet
    db.prepare("UPDATE wallets SET balance = balance + ? WHERE user_id = ?").run(
      amount,
      tx.user_id
    );

    // mark tx done
    db.prepare("UPDATE transactions SET status = 'done' WHERE id = ?").run(tx.id);

    console.log("[passimpay] credited:", { user: tx.user_id, amount });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[passimpay] error", err);
    return new NextResponse("server error", { status: 500 });
  }
}
