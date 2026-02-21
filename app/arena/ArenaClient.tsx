"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/components/utils/cn";
import ArenaShell from "./ArenaShell";
import { Crosshair, Swords, Trophy } from "lucide-react";

type T = {
  id: string;
  title: string;
  game: string;
  teamSize: number;
  entryFee: number;
  currency: string;
  maxPlayers: number;
  players: number;
  status: "open" | "live" | "finished";
};

export default function ArenaClient() {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/arena/tournaments", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setItems(j?.tournaments ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function join(tournamentId: string) {
    setBusy(tournamentId);
    const r = await fetch("/api/arena/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId }),
      credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) {
      alert(j?.error || "Ошибка");
      return;
    }
    // refresh wallet chip + list
    window.dispatchEvent(new Event("wallet:refresh"));
    await load();
  }

  const visible = items.filter((t) => t.game !== "Dota 2" && t.game !== "Valorant");

  const openCount = visible.filter((t) => t.status === "open").length;
  const liveCount = visible.filter((t) => t.status === "live").length;
  const todayPool = visible.reduce((sum, t) => {
    // rough pool estimate: entryFee * maxPlayers (safe for display)
    const pool = Number.isFinite(t.entryFee) ? t.entryFee * t.maxPlayers : 0;
    return sum + pool;
  }, 0);

  return (
    <ArenaShell>
      <div className="relative">
        <div className="relative z-10">
      {/* Hero (Faceit-like) */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 arena-hero-bg" aria-hidden />
        <div className="absolute inset-0 bg-black/45" aria-hidden />
        <div className="absolute -top-24 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" aria-hidden />

        <div className="relative mx-auto max-w-[1100px] px-4 py-16 md:py-20">
          <div className="text-center">
            <div className="mx-auto inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/35 px-5 py-2">
              <span className="text-white font-extrabold tracking-[0.32em] text-sm">
                BEAV<span className="text-accent">BET</span>
              </span>
              <span className="h-4 w-px bg-white/15" />
              <span className="text-white/70 text-sm">ARENA</span>
            </div>

            <h1 className="mt-8 text-4xl md:text-5xl font-extrabold text-white">
              Испытай себя!
            </h1>
            <p className="mt-4 text-white/70 max-w-[720px] mx-auto">
              Дуэли 1v1 и турниры: входной взнос → призовой фонд → выплаты победителям.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/arena/duels/cs2" className="px-6 py-3 rounded-2xl btn-accent text-black font-extrabold">
                Начать дуэль
              </Link>
              <Link
                href="/arena/matches"
                className="px-6 py-3 rounded-2xl bg-white/6 border border-white/12 hover:bg-white/10 text-white/90 font-semibold"
              >
                Мои матчи
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* Feature row */}
      <section className="mx-auto max-w-[1100px] px-4 -mt-8 md:-mt-10 relative">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-3xl card-glass p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/6 border border-white/10">
              <Crosshair className="h-5 w-5 text-white" />
            </div>
            <div className="mt-4 text-white font-semibold">Дуэли 1vs1</div>
            <div className="mt-1 text-sm text-white/60">
              Быстрый матч, честные правила, мгновенный результат.
            </div>
          </div>

          <div className="rounded-3xl card-glass p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/6 border border-white/10">
              <Swords className="h-5 w-5 text-white" />
            </div>
            <div className="mt-4 text-white font-semibold">Турниры</div>
            <div className="mt-1 text-sm text-white/60">
              Входной взнос формирует призовой фонд. Побеждай — забирай.
            </div>
          </div>

          <div className="rounded-3xl card-glass p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/6 border border-white/10">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div className="mt-4 text-white font-semibold">Рейтинги и награды</div>
            <div className="mt-1 text-sm text-white/60">
              Следи за прогрессом, поднимайся выше и забирай бонусы.
            </div>
          </div>
        </div>
      </section>

      {/* Tournaments */}
      <section className="mx-auto max-w-[1100px] px-4 py-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-white text-2xl font-extrabold">Турниры</div>
            <div className="mt-1 text-white/60 text-sm">
              Выбирай турнир и жми JOIN. Если не хватает баланса — пополни кошелёк.
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
        {loading ? (
          <div className="text-white/60">Загрузка…</div>
        ) : items.length === 0 ? (
          <div className="text-white/60">Нет турниров</div>
        ) : (
          visible.map((t) => {
            const pct = Math.round((t.players / t.maxPlayers) * 100);
            const isOpen = t.status === "open";
            return (
              <div key={t.id} className="rounded-3xl card-glass p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-white font-semibold text-lg">
                      {t.game} • {t.title}
                    </div>
                    <div className="mt-1 text-white/60 text-sm">
                      Entry:{" "}
                      <span className="text-white/85 font-semibold">
                        {t.entryFee} {t.currency}
                      </span>{" "}
                      • Players: {t.players}/{t.maxPlayers}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/arena/${t.id}`}
                      className="px-4 py-2 rounded-2xl bg-white/6 border border-white/10 hover:bg-white/10 text-sm text-white/85"
                    >
                      Открыть
                    </Link>

                    <button
                      disabled={!isOpen || busy === t.id}
                      onClick={() => join(t.id)}
                      className={cn(
                        "px-4 py-2 rounded-2xl text-sm font-semibold",
                        isOpen ? "btn-accent" : "bg-white/10 text-white/40",
                        busy === t.id && "opacity-70"
                      )}
                    >
                      {isOpen ? (busy === t.id ? "…" : "JOIN") : t.status.toUpperCase()}
                    </button>
                  </div>
                </div>

                <div className="mt-3 h-2 rounded-full bg-white/8 overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        )}
        </div>
          </section>
        </div>
      </div>
    </ArenaShell>
  );
}
