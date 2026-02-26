"use client";

import { useEffect, useMemo, useState } from "react";

type ApiData = {
  profile: { code: string; status: string; link: string };
  stats: {
    clicks: number;
    referredPlayers: number;
    ftd: number;
    depositCount: number;
    depositSum: number;
    earned: number;
    available: number;
  };
  referrals: Array<{ userId: string; emailMasked: string; createdAt: number }>;
};

function fmt(v: number) {
  const abs = Math.abs(v);
  if (abs > 0 && abs < 1) return v.toFixed(6);
  return v.toFixed(2);
}

export default function AffiliatePanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiData | null>(null);
  const [copied, setCopied] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("10");
  const [currency, setCurrency] = useState<"USD" | "EUR" | "USDT" | "BTC">("USDT");
  const [method, setMethod] = useState("USDT TRC20");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const link = useMemo(() => data?.profile.link || "", [data]);

  async function refresh() {
    setError(null);
    setLoading(true);
    const r = await fetch("/api/affiliate/me", { cache: "no-store", credentials: "include" });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) {
      setError("Не удалось загрузить афилку");
      setLoading(false);
      return;
    }
    setData(j);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  async function requestWithdraw() {
    setBusy(true);
    setError(null);
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setError("Введите корректную сумму");
      setBusy(false);
      return;
    }
    const r = await fetch("/api/affiliate/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ amount: num, currency, method, details }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) {
      setError(j?.error === "INSUFFICIENT" ? "Недостаточно доступно к выводу" : "Ошибка вывода");
      setBusy(false);
      return;
    }
    setWithdrawOpen(false);
    setAmount("10");
    setDetails("");
    await refresh();
    setBusy(false);
  }

  if (loading) {
    return <div className="rounded-3xl card-glass p-6 text-white/70">Загрузка…</div>;
  }
  if (error && !data) {
    return <div className="rounded-3xl card-glass p-6 text-white/70">{error}</div>;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-white/70 text-sm">{error}</div>
      ) : null}

      <div className="rounded-3xl card-glass p-6">
        <div className="text-white font-semibold text-lg">Реферальная ссылка</div>
        <div className="mt-3 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white/85 text-sm break-all">
            {link}
          </div>
          <div className="flex gap-2">
            <button onClick={copy} className="px-5 py-3 rounded-2xl btn-accent font-semibold">
              {copied ? "Скопировано" : "Copy"}
            </button>
            <button
              onClick={() => setWithdrawOpen(true)}
              className="px-5 py-3 rounded-2xl bg-white/8 border border-white/10 hover:bg-white/10 font-semibold"
            >
              Вывести средства
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Клики" value={data?.stats.clicks ?? 0} />
          <Stat label="Игроков" value={data?.stats.referredPlayers ?? 0} />
          <Stat label="FTD" value={data?.stats.ftd ?? 0} />
          <Stat label="Депозиты" value={`${fmt(data?.stats.depositSum ?? 0)}`} />
          <Stat label="Заработано" value={`${fmt(data?.stats.earned ?? 0)}`} />
          <Stat label="Доступно" value={`${fmt(data?.stats.available ?? 0)}`} accent />
        </div>
      </div>

      <div className="rounded-3xl card-glass p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-white font-semibold text-lg">Приведённые игроки</div>
            <div className="mt-1 text-white/55 text-sm">Email скрыт, список для быстрой проверки</div>
          </div>
          <button onClick={refresh} className="px-4 py-2 rounded-2xl bg-white/8 border border-white/10 text-sm hover:bg-white/10">
            Обновить
          </button>
        </div>

        {data?.referrals?.length ? (
          <div className="mt-4 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-white/55">
                  <th className="text-left font-semibold py-2 pr-4">Игрок</th>
                  <th className="text-left font-semibold py-2 pr-4">Дата регистрации</th>
                </tr>
              </thead>
              <tbody>
                {data.referrals.map((r) => (
                  <tr key={r.userId} className="border-t border-white/10">
                    <td className="py-3 pr-4 text-white/85">{r.emailMasked}</td>
                    <td className="py-3 pr-4 text-white/60">{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 text-white/55 text-sm">Пока никого не привели. Скиньте ссылку друзьям 🙂</div>
        )}
      </div>

      {withdrawOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[560px] rounded-3xl card-glass p-6">
            <div className="text-white text-lg font-semibold">Вывод средств (афилка)</div>
            <div className="mt-1 text-white/55 text-sm">Заявка попадёт в админку. Выплата подтверждается вручную.</div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <label>
                <div className="text-white/55 text-xs mb-1">Сумма</div>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 outline-none focus:border-white/20 text-white/85"
                />
              </label>
              <label>
                <div className="text-white/55 text-xs mb-1">Валюта</div>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 outline-none focus:border-white/20 text-white/85"
                >
                  {(["USDT", "USD", "EUR", "BTC"] as const).map((c) => (
                    <option key={c} value={c} className="bg-bg">
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="md:col-span-2">
                <div className="text-white/55 text-xs mb-1">Метод</div>
                <input
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 outline-none focus:border-white/20 text-white/85"
                  placeholder="USDT TRC20"
                />
              </label>
              <label className="md:col-span-2">
                <div className="text-white/55 text-xs mb-1">Реквизиты</div>
                <input
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 outline-none focus:border-white/20 text-white/85"
                  placeholder="Адрес кошелька / IBAN и т.д."
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                onClick={() => setWithdrawOpen(false)}
                className="px-5 py-3 rounded-2xl bg-white/8 border border-white/10 hover:bg-white/10 font-semibold"
              >
                Отмена
              </button>
              <button
                disabled={busy}
                onClick={requestWithdraw}
                className="px-5 py-3 rounded-2xl btn-accent font-semibold disabled:opacity-50"
              >
                Создать заявку
              </button>
            </div>
            <div className="mt-3 text-white/50 text-xs">Доступно: {fmt(data?.stats.available ?? 0)}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <div className="text-white/55 text-xs">{label}</div>
      <div className={`mt-1 text-white ${accent ? "text-[#1EF48E]" : ""} text-xl font-extrabold`}>{value}</div>
    </div>
  );
}
