"use client";

import { useEffect, useMemo, useRef } from "react";

type WalletMain = { currency: string; balance: number } | null;

function makeId() {
  // Browser-safe UUID
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "rid_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function Page() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const rounds = useMemo(() => {
    return new Map<string, { bet: number; currency: string; settled: boolean }>();
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let cancelled = false;

    async function getMainWallet(): Promise<WalletMain> {
      const r = await fetch("/api/account/wallet", { cache: "no-store" });
      if (!r.ok) throw new Error("WALLET_FETCH_FAILED");
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "WALLET_BAD");
      return j.main || null;
    }

    const api = {
      async getBalance() {
        const main = await getMainWallet();
        return Number(main?.balance ?? 0);
      },

      async placeBet(amount: number) {
        const main = await getMainWallet();
        const currency = String(main?.currency || "EUR").toUpperCase();
        const bet = Number(amount);

        if (!Number.isFinite(bet) || bet <= 0) throw new Error("INVALID_BET");

        const rid = makeId();
        rounds.set(rid, { bet, currency, settled: false });

        const r = await fetch("/api/casino/roulette/wager", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: bet, currency, meta: { roundId: rid } }),
        });

        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) {
          rounds.delete(rid);
          throw new Error(j?.error || "WAGER_FAILED");
        }

        return { balance: Number(j.newBalance ?? 0), roundId: rid, currency };
      },

      // Settles the round with a payout amount (bet * multiplier)
      async cashOut(payload: { roundId: string; payout: number; item?: string; mult?: number }) {
        const rid = String(payload?.roundId || "");
        const ctx = rounds.get(rid);
        if (!ctx || ctx.settled) {
          const main = await getMainWallet();
          return { balance: Number(main?.balance ?? 0) };
        }

        const payout = Number(payload?.payout ?? 0);
        if (!Number.isFinite(payout) || payout < 0) throw new Error("INVALID_PAYOUT");

        ctx.settled = true;
        rounds.set(rid, ctx);

        if (payout === 0) {
          const main = await getMainWallet();
          return { balance: Number(main?.balance ?? 0) };
        }

        const r = await fetch("/api/casino/roulette/payout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: payout,
            currency: ctx.currency,
            meta: { roundId: rid, item: payload?.item, multiplier: payload?.mult },
          }),
        });

        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) throw new Error(j?.error || "PAYOUT_FAILED");
        return { balance: Number(j.newBalance ?? 0) };
      },

      async finishRound(payload: { roundId: string; result?: string; mult?: number }) {
        const rid = String(payload?.roundId || "");
        rounds.delete(rid);
        const main = await getMainWallet();
        return { balance: Number(main?.balance ?? 0) };
      },

      getContext() {
        return { game: "roulette" };
      },
    } as const;

    function onLoad() {
      if (cancelled) return;
      const iframeEl = iframeRef.current;
      if (!iframeEl || !iframeEl.contentWindow) return;

      // Inject bridge into iframe
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (iframeEl.contentWindow as any).BEAVBET_BRIDGE = api;
      iframeEl.contentWindow.postMessage({ type: "BEAVBET_BRIDGE_READY" }, "*");
    }

    iframe.addEventListener("load", onLoad);

    return () => {
      cancelled = true;
      iframe.removeEventListener("load", onLoad);
    };
  }, [rounds]);

  return (
    <div className="w-full">
      <div className="rounded-3xl overflow-hidden border border-white/10 bg-white/5">
        <iframe
          ref={iframeRef}
          title="Case Roulette"
          src="/games/roulette/index.html"
          className="w-full"
          style={{ height: "calc(100vh - 170px)", minHeight: 680 }}
        />
      </div>
    </div>
  );
}
