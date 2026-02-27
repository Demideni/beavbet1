"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/components/utils/cn";
import { Gift, Timer, Swords } from "lucide-react";

type Status = {
  ok: boolean;
  canSpin: boolean;
  nextAt: number;
  playedMatches24h: number;
  lastReward: null | { at: number; type: string; value: number | null; meta: any };
};

type Reward = { type: string; value: number; meta?: any };

type ReelItem = {
  key: string;
  label: string;
  sub?: string;
  icon?: string;
};

function prettyTimeLeft(ms: number) {
  if (ms <= 0) return "0m";
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function rewardText(r: Reward | null) {
  if (!r) return null;
  if (r.type === "coins") return `+${r.value} Arena Coins`;
  if (r.type === "xp") return `+${r.value} XP`;
  if (r.type === "premium_hours") return `+${r.value}h Premium`;
  if (r.type === "badge") return `Badge: ${(r.meta?.badge || "daily-lucky").toString()}`;
  return `${r.type} +${r.value}`;
}

export default function DailyRewardSpin() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState<Reward | null>(null);
  const [offset, setOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const reel = useMemo<ReelItem[]>(() => {
    // UI-лента как в кейсах. Результат выбирает сервер, это только визуал.
    const base: ReelItem[] = [
  { key: "coins50", label: "+50 Coins", icon: "/arena/spin/coins-50.png" },
  { key: "coins100", label: "+100 Coins", icon: "/arena/spin/coins-100.png" },
  { key: "xp200", label: "+200 XP", icon: "/arena/spin/xp-200.png" },
  { key: "prem6", label: "+6h Premium", icon: "/arena/spin/premium-6h.png" },
  { key: "badge", label: "Lucky Badge", icon: "/arena/spin/badge-lucky.png" },
];

    const out: ReelItem[] = [];
    for (let i = 0; i < 40; i++) out.push(base[i % base.length]);
    return out;
  }, []);

  async function refresh() {
    const r = await fetch("/api/arena/rewards/spin", { method: "GET", cache: "no-store" }).catch(() => null);
    if (!r || !r.ok) return;
    const j = (await r.json().catch(() => null)) as Status | null;
    if (!j?.ok) return;
    setStatus(j);
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!status?.nextAt) return;
    const t = setInterval(() => setStatus((s) => (s ? { ...s } : s)), 15000);
    return () => clearInterval(t);
  }, [status?.nextAt]);

  async function spin() {
    if (loading || spinning) return;
    setLoading(true);

    const r = await fetch("/api/arena/rewards/spin", { method: "POST" }).catch(() => null);
    const j = await r?.json().catch(() => null);

    setLoading(false);

    if (!r || !r.ok || !j?.ok) {
      const err = j?.error || "ERROR";
      if (err === "NEED_2_MATCHES") alert("Нужно сыграть 2 матча за последние 24 часа.");
      else if (err === "ALREADY_SPUN") alert("Уже крутили. Попробуйте позже.");
      else alert(err);
      await refresh();
      return;
    }

    const reward: Reward = j.reward;
    setLastWin(reward);

    // UI animation: landing index based on reward type
    const itemWidth = 156;
    const centerPx = containerRef.current ? containerRef.current.clientWidth / 2 : 360;

    const targetKey =
      reward.type === "coins" ? (reward.value >= 100 ? "coins100" : "coins50") :
      reward.type === "xp" ? "xp200" :
      reward.type === "premium_hours" ? "prem6" :
      "badge";

    const candidates: number[] = [];
    for (let i = 0; i < reel.length; i++) if (reel[i].key === targetKey) candidates.push(i);
    const idx = candidates.length ? candidates[candidates.length - 2] ?? candidates[candidates.length - 1] : reel.length - 1;

    const target = -(idx * itemWidth) + centerPx - itemWidth / 2;

    setSpinning(true);
    setOffset(target);

    setTimeout(async () => {
      setSpinning(false);
      await refresh();
    }, 4200);
  }

  const canSpin = Boolean(status?.canSpin);
  const msLeft = status?.nextAt ? status.nextAt - Date.now() : 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 backdrop-blur-xl p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-white font-extrabold text-lg">
            <Gift className="h-5 w-5 text-accent" /> Daily Reward
          </div>
          <div className="mt-1 text-white/60 text-sm">
            Сыграй <span className="text-white font-bold">2 матча</span> за 24 часа — получи 1 прокрутку.
          </div>
        </div>

        <div className="text-right">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-extrabold text-white/85">
            <Swords className="h-4 w-4 text-white/60" />
            {status ? `${status.playedMatches24h}/2` : "—"}
          </div>
          <div className="mt-2 inline-flex items-center gap-2 text-white/60 text-xs">
            <Timer className="h-4 w-4" />
            {canSpin ? "Готово" : msLeft > 0 ? `через ${prettyTimeLeft(msLeft)}` : "—"}
          </div>
        </div>
      </div>

      <div className="mt-5 relative overflow-hidden rounded-3xl border border-white/10 bg-black/35">
  <img
    src="/arena/spin/spin-bg.png"
    alt=""
    className="absolute inset-0 w-full h-full object-cover opacity-35"
  />
  <img
    src="/arena/spin/spin-glow.png"
    alt=""
    className="absolute inset-0 w-full h-full object-cover opacity-45 pointer-events-none"
  />
  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute inset-y-0 left-1/2 w-[2px] bg-accent/90 z-10" />
        <div ref={containerRef} className="relative w-full overflow-hidden">
          <div
            className={cn(
              "flex items-center gap-3 px-4 py-5",
              spinning ? "transition-transform duration-[4200ms] ease-out" : "transition-transform duration-300"
            )}
            style={{ transform: `translateX(${offset}px)` }}
          >
            {reel.map((it, i) => (
              <div
                key={`${it.key}-${i}`}
               className="w-[140px] h-[86px] rounded-2xl border border-white/10 bg-white/5 flex items-center gap-3 px-3">
  {it.icon ? (
    <img src={it.icon} alt="" className="h-11 w-11 object-contain shrink-0" />
  ) : null}

  <div className="min-w-0">
    <div className="text-white font-extrabold text-sm truncate">{it.label}</div>
    <div className="text-white/45 text-[11px] mt-1">BeavBet Arena</div>
  </div>
</div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={spin}
          disabled={!canSpin || loading || spinning}
          className={cn(
            "h-11 px-6 rounded-2xl font-extrabold",
            !canSpin || loading || spinning
              ? "bg-white/10 text-white/40 cursor-not-allowed"
              : "bg-accent text-black hover:brightness-110"
          )}
        >
          {loading ? "..." : spinning ? "Крутим…" : "Крутить"}
        </button>

        {lastWin ? (
          <div className="text-white/85 text-sm font-semibold">
            Выпало: <span className="text-white font-extrabold">{rewardText(lastWin)}</span>
          </div>
        ) : (
          <div className="text-white/45 text-sm">Крути и получай бонусы (без скинов/ножей — легально).</div>
        )}
      </div>

      <div className="mt-2 text-white/35 text-xs">
        Награды: Arena Coins / XP / Premium часы / косметический бейдж. Не деньги и не рыночные предметы.
      </div>
    </div>
  );
}