import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const Schema = z.object({
  amount: z.number().finite().positive().max(1000000),
  currency: z.enum(["USD", "EUR", "USDT", "BTC"]).default("EUR"),
});

type PPResp = any;

function hmacHexLower(key: string, msg: string) {
  return crypto.createHmac("sha256", key).update(msg, "utf8").digest("hex").toLowerCase();
}

function sha256HexLower(msg: string) {
  return crypto.createHash("sha256").update(msg, "utf8").digest("hex").toLowerCase();
}

async function tryCreateOrder(opts: {
  baseUrl: string;
  platformId: string;
  apiKey: string;
  bodyStr: string;
  signature: string;
  signatureMode: string;
}) {
  const { baseUrl, platformId, bodyStr, signature, signatureMode } = opts;

  const r = await fetch(`${baseUrl}/v2/createorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-signature": signature,
      // Иногда помогают и такие заголовки — не мешают:
      "x-platform-id": platformId,
    },
    body: bodyStr,
    cache: "no-store",
  });

  const data: PPResp = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data, signatureMode };
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const platformId = (process.env.PASSIMPAY_PLATFORM_ID || "").trim();
  const apiKey = (process.env.PASSIMPAY_API_KEY || "").trim();
  const baseUrl = (process.env.PASSIMPAY_BASE_URL || "https://api.passimpay.io").trim();

  if (!platformId || !apiKey) {
    return NextResponse.json({ ok: false, error: "PASSIMPAY_NOT_CONFIGURED" }, { status: 500 });
  }

  const { amount, currency } = parsed.data;

  const db = getDb();
  const now = Date.now();

  // Ensure wallet exists (но не начисляем тут)
  const w = db
    .prepare("SELECT id FROM wallets WHERE user_id = ? AND currency = ?")
    .get(session.id, currency) as { id: string } | undefined;

  if (!w) {
    db.prepare("INSERT INTO wallets (id, user_id, currency, balance, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(randomUUID(), session.id, currency, 0, now);
  }

  const orderId = randomUUID();

  // ВАЖНО: platformId В BODY, amount СТРОКОЙ
  // Порядок ключей фиксируем (это может влиять, если они считают подпись по строке body).
  const bodyObj: Record<string, any> = {
    platformId,
    orderId,
    amount: amount.toFixed(2),
    symbol: currency,
  };

  const bodyStr = JSON.stringify(bodyObj);

  // Контракт, который у тебя уже работает на webhook:
  const contract = `${platformId};${bodyStr};${apiKey}`;

  // Пробуем форматы подписи:
  // 1) HMAC_SHA256(apiKey, contract)   <-- как в webhook
  // 2) SHA256(contract)                <-- иногда createorder так хотят
  // 3) SHA256(bodyStr + apiKey)        <-- встречается у некоторых аккаунтов/версий
  const attempts = [
    { mode: "hmac(contract)", sig: hmacHexLower(apiKey, contract) },
    { mode: "sha256(contract)", sig: sha256HexLower(contract) },
    { mode: "sha256(body+key)", sig: sha256HexLower(bodyStr + apiKey) },
  ];

  let last: any = null;

  for (const a of attempts) {
    const res = await tryCreateOrder({
      baseUrl,
      platformId,
      apiKey,
      bodyStr,
      signature: a.sig,
      signatureMode: a.mode,
    });

    last = res;

    if (res.ok && res.data?.url) {
      // Save pending tx
      const txId = randomUUID();
      db.prepare(
        "INSERT INTO transactions (id, user_id, type, amount, currency, status, created_at, meta, provider, provider_ref, order_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        txId,
        session.id,
        "deposit",
        amount,
        currency,
        "pending",
        now,
        JSON.stringify({ passimpay: { url: res.data.url, response: res.data, sigMode: a.mode } }),
        "passimpay",
        res.data.paymentId ?? null,
        orderId,
        now
      );

      return NextResponse.json({ ok: true, url: res.data.url, orderId });
    }

    // если явно “platformId error” — смысла менять подпись нет, но у нас platformId уже в body
    // если “incorrect signature” — пробуем следующий a.mode
  }

  console.error("[passimpay][deposit] createorder failed after attempts", {
    status: last?.status,
    details: last?.data,
    tried: attempts.map((x) => x.mode),
    // на время дебага можно включить:
    // bodyStr,
    // contract,
  });

  return NextResponse.json(
    {
      ok: false,
      error: "PASSIMPAY_ERROR",
      status: last?.status ?? 400,
      details: last?.data,
      tried: attempts.map((x) => x.mode),
    },
    { status: 400 }
  );
}
