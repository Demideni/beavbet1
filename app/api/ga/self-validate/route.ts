import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function callGA(body: URLSearchParams) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.beavbet.com";
  const url = `${base}/api/ga/callback`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await res.json().catch(() => null);

  return { status: res.status, json };
}

export async function GET() {
  const player = `selftest_${Date.now()}`;
  const currency = "EUR";

  const results: any = {};

  try {
    // 1) balance
    const balanceRes = await callGA(
      new URLSearchParams({
        action: "balance",
        player_id: player,
        currency,
      })
    );

    results.balance = balanceRes;

    // 2) bet
    const betTx = `tx_bet_${Date.now()}`;
    const betRes = await callGA(
      new URLSearchParams({
        action: "bet",
        player_id: player,
        currency,
        amount: "1.00",
        transaction_id: betTx,
      })
    );

    results.bet = betRes;

    // 3) same bet (idempotency)
    const betRepeat = await callGA(
      new URLSearchParams({
        action: "bet",
        player_id: player,
        currency,
        amount: "1.00",
        transaction_id: betTx,
      })
    );

    results.idempotency = betRepeat;

    // 4) win
    const winTx = `tx_win_${Date.now()}`;
    const winRes = await callGA(
      new URLSearchParams({
        action: "win",
        player_id: player,
        currency,
        amount: "2.00",
        transaction_id: winTx,
      })
    );

    results.win = winRes;

    return NextResponse.json({
      ok: true,
      message: "Self validation executed",
      results,
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e.message,
    });
  }
}
