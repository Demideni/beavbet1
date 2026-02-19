import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

async function callGA(req: Request, body: URLSearchParams) {
  const url = new URL(req.url);

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
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

function num(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error: "UNAUTH",
        hint: "Login first, then open /api/ga/self-validate",
      },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const currency = (url.searchParams.get("currency") || "EUR").toUpperCase();
  const betAmount = url.searchParams.get("bet") || "0.10"; // можно менять в URL: ?bet=0.25

  const player = session.id;
  const results: any = {};
  const checks: any = {};

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

    const b0 = num(results.balance?.json?.balance);

    // 2) bet
    const betTx = `self_bet_${Date.now()}`;
    results.bet = await callGA(
      req,
      new URLSearchParams({
        action: "bet",
        player_id: player,
        currency,
        amount: betAmount,
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
        amount: betAmount,
        transaction_id: betTx,
      })
    );

    // 4) refund (should revert the bet)
    const refundTx = `self_refund_${Date.now()}`;
    results.refund = await callGA(
      req,
      new URLSearchParams({
        action: "refund",
        player_id: player,
        currency,
        amount: betAmount,
        transaction_id: refundTx,
        bet_transaction_id: betTx,
        // round_id не обязателен — провайдер тестит и без него
      })
    );

    // 5) win
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

    // ---- checks (не влияет на провайдера, просто тебе видно PASS/FAIL)
    const betJson = results.bet?.json || {};
    const idemJson = results.idempotency?.json || {};
    const refundJson = results.refund?.json || {};

    const bBet = num(betJson.balance);
    const bIdem = num(idemJson.balance);
    const bRefund = num(refundJson.balance);

    checks.balance_ok =
      results.balance?.status === 200 &&
      results.balance?.json &&
      Object.keys(results.balance.json).length === 1 &&
      typeof results.balance.json.balance === "number";

    checks.bet_ok =
      results.bet?.status === 200 &&
      betJson &&
      !betJson.error_code &&
      Object.keys(betJson).length === 2 &&
      betJson.transaction_id === betTx;

    checks.idempotency_ok =
      results.idempotency?.status === 200 &&
      idemJson &&
      !idemJson.error_code &&
      idemJson.transaction_id === betTx &&
      bIdem === bBet;

    checks.refund_ok =
      results.refund?.status === 200 &&
      refundJson &&
      !refundJson.error_code &&
      Object.keys(refundJson).length === 2 &&
      refundJson.transaction_id === refundTx &&
      // refund должен вернуть баланс обратно (примерно b0 - bet + bet == b0)
      Math.abs(bRefund - b0) < 0.0001;

    checks.win_ok =
      results.win?.status === 200 &&
      results.win?.json &&
      !results.win.json.error_code &&
      Object.keys(results.win.json).length === 2 &&
      typeof results.win.json.balance === "number" &&
      typeof results.win.json.transaction_id === "string";

    const allOk =
      checks.balance_ok &&
      checks.bet_ok &&
      checks.idempotency_ok &&
      checks.refund_ok &&
      checks.win_ok;

    return NextResponse.json({
      ok: true,
      passed: allOk,
      message: "Self validation executed",
      player_id: player,
      currency,
      bet_amount: betAmount,
      checks,
      results,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
