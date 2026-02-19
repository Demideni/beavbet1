import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const {
      amount,
      currency,
      userId,
    }: { amount: number; currency: string; userId: string } =
      await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    const platformId = process.env.PASSIMPAY_PLATFORM_ID!;
    const apiKey = process.env.PASSIMPAY_API_KEY!;
    const baseUrl =
      process.env.PASSIMPAY_BASE_URL || "https://api.passimpay.io";

    if (!platformId || !apiKey) {
      console.error("Missing PassimPay env vars");
      return NextResponse.json(
        { error: "Server config error" },
        { status: 500 }
      );
    }

    const orderId = randomUUID();

    // формируем домен (Render/production compatible)
    const origin =
      req.headers.get("origin") ||
      (req.headers.get("host")
        ? `https://${req.headers.get("host")}`
        : "");

    const callbackUrl = origin
      ? `${origin}/api/payments/passimpay/webhook`
      : undefined;

    const successUrl = origin
      ? `${origin}/payments?pp=success&orderId=${orderId}`
      : undefined;

    const failUrl = origin
      ? `${origin}/payments?pp=fail&orderId=${orderId}`
      : undefined;

    // тело запроса — EXACT JSON (важно для подписи)
    const bodyObj: Record<string, any> = {
      platformId,
      orderId,
      amount: Number(amount.toFixed(2)),
      symbol: currency,
      ...(callbackUrl ? { callbackUrl } : {}),
      ...(successUrl ? { successUrl } : {}),
      ...(failUrl ? { failUrl } : {}),
    };

    const bodyStr = JSON.stringify(bodyObj);

    // подпись по документации PassimPay:
    // signature = sha256(`${platformId};${bodyStr};${apiKey}`)
    const signature = crypto
      .createHash("sha256")
      .update(`${platformId};${bodyStr};${apiKey}`)
      .digest("hex");

    const response = await fetch(`${baseUrl}/v2/createorder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-signature": signature,
        "x-platform-id": platformId,
      },
      body: bodyStr,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("PassimPay createorder failed:", data);
      return NextResponse.json(
        { error: "PassimPay error", details: data },
        { status: 400 }
      );
    }

    if (!data?.url) {
      console.error("PassimPay response missing URL:", data);
      return NextResponse.json(
        { error: "No redirect URL from PassimPay" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      url: data.url,
      orderId,
    });
  } catch (err) {
    console.error("Deposit error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
