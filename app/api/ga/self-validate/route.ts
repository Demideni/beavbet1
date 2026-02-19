import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

async function callGA(req: Request, body: URLSearchParams) {
  const url = new URL(req.url);

  // Берем origin корректно на Render (x-forwarded-*) и локально
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const origin = `${proto}://${host}`;

  const endpoint = `${origin}/api/ga/callback`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

export async function GET(req: Request) {
  // ✅ Только для залогиненного юзера (чтобы player_id точно существовал в users)
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "UNAUTH", hint: "Login first, then open /api/ga/self-validate" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const currency = (url.searchParams.get("currency") || "EUR").toUpperCase();

  const player = session.id; // ✅ существующий users.id
  const results: any = {};

  try {
    // 1) balance
    results.balance = await callGA(
      req,
      new URLSearchParams({
        action: "balance",
        player_id: player,
        currency,
      })
    );

    // 2) bet
    const betTx = `self_bet_${Date.now()}`;
    results.bet = await callGA(
      req,
      new URLSearchParams({
        action: "bet",
        player_id: player,
        currency,
        amount: "0.10",
        transaction_id: betTx,
      })
    );

    // 3) idempotency (same tx again)
    results.idempotency = await callGA(
      req,
      new URLSearchParams({
        action: "bet",
        player_id: player,
        currency,
        amount: "0.10",
        transaction_id: betTx,
      })
    );

    // 4) win
    const winTx = `self_win_${Date.now()}`;
    results.win = await callGA(
      req,
      new URLSearchParams({
        action: "win",
        player_id: player,
        currency,
        amount: "2.00",
        transaction_id: winTx,
      })
    );

    return NextResponse.json({
      ok: true,
      message: "Self validation executed",
      player_id: player,
      currency,
      results,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
