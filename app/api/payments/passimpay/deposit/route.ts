import { NextRequest, NextResponse } from "next/server";

function normalizeBaseUrl(u: string) {
  return (u || "").trim().replace(/\/+$/, "");
}

function getHeader(req: NextRequest, name: string) {
  return req.headers.get(name) || req.headers.get(name.toLowerCase()) || "";
}

async function safeReadJson(resp: Response) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const baseUrlRaw = process.env.PASSIMPAY_BASE_URL || "";
    const baseUrl = normalizeBaseUrl(baseUrlRaw);

    const platformId =
      process.env.PASSIMPAY_PLATFORM_ID ||
      process.env.PASSIMPAY_PLATFORMID ||
      "";

    const apiKey =
      process.env.PASSIMPAY_API_KEY ||
      process.env.PASSIMPAY_APIKEY ||
      "";

    if (!baseUrl || !platformId || !apiKey) {
      console.error("[passimpay][deposit] missing env", {
        hasBaseUrl: !!baseUrl,
        hasPlatformId: !!platformId,
        hasApiKey: !!apiKey,
      });
      return NextResponse.json(
        { ok: false, error: "missing env" },
        { status: 500 }
      );
    }

    const userId = getHeader(req, "x-user-id");
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "missing x-user-id" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const amount = Number((body as any)?.amount || 0);
    const currency = String((body as any)?.currency || "EUR").toUpperCase();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: "invalid amount" },
        { status: 400 }
      );
    }

    // NOTE: callback/success/fail подстрой под свои реальные урлы (если у тебя иначе)
    const payload = {
      platformId: Number(platformId) || platformId,
      apiKey,
      amount,
      currency,
      orderId: cryptoRandomId(),
      // куда PassimPay отправит webhook (у тебя он уже работает)
      callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.beavbet.com"}/api/payments/passimpay/webhook`,
      // куда редиректить пользователя после успеха/ошибки
      successUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.beavbet.com"}/payments?status=success`,
      failUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.beavbet.com"}/payments?status=fail`,
      // если PassimPay позволяет — прокидываем userId в мету
      meta: { userId },
    };

    // 🔥 Fallback: пробуем разные пути (у них часто отличается /api, /v2 и т.д.)
    const candidates = [
      "/v2/createorder",
      "/api/v2/createorder",
      "/v2/createOrder",
      "/api/v2/createOrder",
      "/createorder",
      "/api/createorder",
    ];

    let lastErr: any = null;

    for (const path of candidates) {
      const url = `${baseUrl}${path}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (r.ok) {
        const data = await safeReadJson(r);
        console.log("[passimpay][deposit] createorder OK", { url, data });

        // ВАЖНО: подстрой под реальный формат ответа PassimPay.
        // Обычно там есть paymentUrl / redirectUrl / url
        const paymentUrl =
          (data as any)?.paymentUrl ||
          (data as any)?.redirectUrl ||
          (data as any)?.url ||
          (data as any)?.data?.paymentUrl ||
          (data as any)?.data?.url;

        if (!paymentUrl) {
          console.error("[passimpay][deposit] no payment url in response", {
            url,
            data,
          });
          return NextResponse.json(
            { ok: false, error: "no payment url", data },
            { status: 502 }
          );
        }

        return NextResponse.json({ ok: true, paymentUrl });
      }

      const details = await safeReadJson(r);
      lastErr = { url, status: r.status, details };
      console.error("[passimpay][deposit] createorder failed", lastErr);
    }

    return NextResponse.json(
      { ok: false, error: "createorder failed", last: lastErr },
      { status: 502 }
    );
  } catch (err: any) {
    console.error("[passimpay][deposit] error", err);
    return NextResponse.json(
      { ok: false, error: "server error" },
      { status: 500 }
    );
  }
}

function cryptoRandomId() {
  // без import crypto, чтобы не конфликтовать в edge; в node тоже ок
  // генерим достаточно уникальный orderId
  return (
    Date.now().toString(16) +
    "-" +
    Math.random().toString(16).slice(2) +
    "-" +
    Math.random().toString(16).slice(2)
  );
}
