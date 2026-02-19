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
    // roundId -> context (kept in the page, not in the iframe)
    return new Map<string, { bet: number; currency: string }>();
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
      // Called by robinson/ui.js on init
      async getBalance() {
        const main = await getMainWallet();
        return Number(main?.balance ?? 0);
      },

      // Called by robinson/ui.js when player hits Play
      async placeBet(amount: number) {
        const main = await getMainWallet();
        const currency = String(main?.currency || "EUR").toUpperCase();
        const bet = Number(amount);

        if (!Number.isFinite(bet) || bet <= 0) throw new Error("INVALID_BET");

        const rid = makeId();
        rounds.set(rid, { bet, currency });

        const r = await fetch("/api/casino/robinson/wager", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: bet,
            currency,
            meta: { roundId: rid },
          }),
        });

        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) {
          rounds.delete(rid);
          throw new Error(j?.error || "WAGER_FAILED");
        }

        return { balance: Number(j.newBalance ?? 0), roundId: rid };
      },

      // Called by robinson/game.js on round end
      async finishRound(payload: { roundId: string; multiplier?: number; result?: string }) {
        const rid = String(payload?.roundId || "");
        const ctx = rounds.get(rid);
        if (!ctx) {
          // Round context missing — just resync balance
          const main = await getMainWallet();
          return { balance: Number(main?.balance ?? 0) };
        }

        const m = Math.max(1, Number(payload?.multiplier ?? 1) || 1);
        const result = String(payload?.result || "").toLowerCase();

        // Convention: multiplier includes stake return (bet * multiplier)
        const shouldPay = result === "won" || result === "win";
        const payout = shouldPay ? Number((ctx.bet * m).toFixed(2)) : 0;

        rounds.delete(rid);

        if (payout <= 0) {
          const main = await getMainWallet();
          return { balance: Number(main?.balance ?? 0) };
        }

        const r = await fetch("/api/casino/robinson/payout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: payout,
            currency: ctx.currency,
            meta: { roundId: rid, multiplier: m, result },
          }),
        });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) {
          throw new Error(j?.error || "PAYOUT_FAILED");
        }

        return { balance: Number(j.newBalance ?? 0) };
      },

      // Optional, but bridge.js references it
      getContext() {
        return { game: "robinson" };
      },
    } as const;

function onLoad() {
  if (cancelled) return;

  const iframeEl = iframeRef.current;
  if (!iframeEl || !iframeEl.contentWindow) return;

  try {
    const w = iframeEl.contentWindow;

    // Expose casino API inside the iframe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (w as any).PULZ_GAME = api;

    // Initial balance sync
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (w as any).RobinsonUI?.refreshBalance?.();
  } catch {
    // ignore
  }
}


    iframe.addEventListener("load", onLoad);
    return () => {
      cancelled = true;
      iframe.removeEventListener("load", onLoad);
    };
  }, [rounds]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black">
      <iframe
        ref={iframeRef}
        title="Robinson"
        src="/games/robinson/index.html"
        className="w-full h-[100dvh]"
        allowFullScreen
      />
    </div>
  );
}
