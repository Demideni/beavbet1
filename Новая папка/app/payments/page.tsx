"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";

type Wallet = { currency: string; balance: number };
type Tx = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: number;
};

function fmtMoney(amount: number) {
  const abs = Math.abs(amount);
  if (abs > 0 && abs < 1) return amount.toFixed(6);
  if (abs >= 1000) return amount.toFixed(2);
  return amount.toFixed(2);
}

export default function PaymentsPage() {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState("EUR");
  const [tx, setTx] = useState<Tx[]>([]);

  const [amount, setAmount] = useState("50");
  const [currency, setCurrency] = useState("EUR");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    const r = await fetch("/api/account/wallet", { cache: "no-store", credentials: "include" });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      setError(t("payments.needLogin"));
      setLoading(false);
      return;
    }
    setWallets(j.wallets || []);
    setDefaultCurrency(j.defaultCurrency || "EUR");
    setCurrency(j.defaultCurrency || "EUR");
    setTx(j.transactions || []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const main = useMemo(() => {
    return wallets.find((w) => w.currency === currency) || null;
  }, [wallets, currency]);

  async function act(kind: "deposit" | "withdraw") {
    setMsg(null);
    setBusy(true);
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setMsg(t("payments.enterValidAmount"));
      setBusy(false);
      return;
    }

    if (kind === "deposit") {
      const r = await fetch(`/api/payments/passimpay/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: num, currency }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.url) {
        setMsg(t("payments.depositError"));
        setBusy(false);
        return;
      }
      window.location.href = j.url;
      return;
    }

    const r = await fetch(`/api/account/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ amount: num, currency }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(j?.error === "INSUFFICIENT" ? t("payments.insufficient") : t("payments.genericError"));
      setBusy(false);
      return;
    }
    setMsg(t("payments.withdrawOk"));
    await refresh();
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="max-w-[980px] mx-auto card-glass rounded-3xl p-6 text-white/70">
        {t("common.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[980px] mx-auto">
        <div className="rounded-3xl card-glass p-6">
          <div className="text-white text-xl font-semibold">{t("payments.title")}</div>
          <div className="mt-2 text-white/60">{error}</div>
          <div className="mt-4 flex gap-2">
            <Link href="/auth?tab=login" className="px-5 py-3 rounded-2xl btn-accent font-semibold">
              {t("topbar.login")}
            </Link>
            <Link href="/" className="px-5 py-3 rounded-2xl bg-white/8 border border-white/10">
              {t("common.toHome")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[980px] mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-white text-2xl font-extrabold tracking-tight">{t("payments.title")}</div>
          <div className="mt-1 text-white/60 text-sm">{t("payments.subtitle")}</div>
        </div>
        <Link href="/account" className="px-4 py-2 rounded-2xl bg-white/8 border border-white/10 text-sm hover:bg-white/10">
          ← {t("topbar.cabinet")}
        </Link>
      </div>

      {msg ? (
        <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4 text-white/75 text-sm">{msg}</div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-3xl card-glass p-5">
          <div className="text-white font-semibold text-lg">{t("payments.balanceBlock")}</div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-white/55 text-xs">{t("payments.selectedCurrency")}</div>
              <div className="mt-1 text-white text-3xl font-extrabold">
                {fmtMoney(main?.balance || 0)} {currency}
              </div>
            </div>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 outline-none focus:border-white/20 text-white/85"
            >
              {wallets.map((w) => (
                <option key={w.currency} value={w.currency} className="bg-bg">
                  {w.currency}
                </option>
              ))}
              {["USD", "EUR", "USDT", "BTC"]
                .filter((c) => !wallets.some((w) => w.currency === c))
                .map((c) => (
                  <option key={c} value={c} className="bg-bg">
                    {c}
                  </option>
                ))}
            </select>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="col-span-2">
              <div className="text-white/55 text-xs mb-1">{t("payments.amount")}</div>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 outline-none focus:border-white/20 text-white/85"
                placeholder="50"
              />
            </label>
            <button
              disabled={busy}
              className="px-6 py-3 rounded-2xl btn-accent font-semibold disabled:opacity-50"
              onClick={() => act("deposit")}
            >
              {t("payments.deposit")}
            </button>
            <button
              disabled={busy}
              className="px-6 py-3 rounded-2xl bg-white/8 border border-white/10 hover:bg-white/10 font-semibold disabled:opacity-50"
              onClick={() => act("withdraw")}
            >
              {t("payments.withdraw")}
            </button>
          </div>
        </section>

        <section className="rounded-3xl card-glass p-5">
          <div className="text-white font-semibold text-lg">{t("payments.history")}</div>
          <div className="mt-4 space-y-2 max-h-[420px] overflow-auto pr-1">
            {tx.length === 0 ? (
              <div className="text-white/60 text-sm">{t("payments.noTx")}</div>
            ) : (
              tx.map((tr) => (
                <div key={tr.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-white/85 font-semibold">
                      {tr.type === "deposit"
                        ? t("payments.tx.deposit")
                        : tr.type === "withdraw"
                          ? t("payments.tx.withdraw")
                          : tr.type}
                    </div>
                    <div className={`text-sm ${tr.type === "withdraw" ? "text-white/80" : "text-white"}`}>
                      {tr.type === "withdraw" ? "-" : "+"}
                      {fmtMoney(tr.amount)} {tr.currency}
                    </div>
                  </div>
                  <div className="mt-1 text-white/50 text-xs">
                    {new Date(tr.createdAt).toLocaleString()} • {tr.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
