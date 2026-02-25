"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ArenaTournament = {
  id: string;
  title: string;
  game: string;
  teamSize: number;
  entryFee: number;
  currency: string;
  maxPlayers: number;
  players: number;
  status: "open" | "live" | "finished" | string;
  startsAt?: number | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}д ${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
}

function StreamerTournamentCard() {
  const [t, setT] = useState<ArenaTournament | null>(null);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      const r = await fetch("/api/arena/tournaments", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      const rows: ArenaTournament[] = j?.tournaments ?? [];
      const zava = rows.find((x) => String(x?.title || "").toLowerCase().includes("зава"));
      if (!alive) return;
      setT(zava ?? null);
    }

    load();
    const poll = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (!t?.startsAt) return;
    const tick = () => setLeft(Math.max(0, Number(t.startsAt) - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [t?.startsAt]);

  const startsLabel = useMemo(() => {
    if (!t?.startsAt) return null;
    // Показать время в Москве (UTC+3)
    const d = new Date(Number(t.startsAt));
    return d.toLocaleString("ru-RU", {
      timeZone: "Europe/Moscow",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [t?.startsAt]);

  // Баннер: положи файл сюда (см. ответ ниже)
  const banner = "/banners/zava-tournament.png";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-xl">
      <img src={banner} alt="Турнир от ЗАВА" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/25" />

      <div className="relative p-6 min-h-[220px] flex flex-col justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/35 px-3 py-1 text-xs font-semibold text-white/80">
            STREAMER TOURNAMENT
          </div>

          <div className="mt-3 text-3xl font-extrabold text-white leading-tight">
            Турнир от стримера <span className="text-accent">ЗАВА</span>
          </div>

          <div className="mt-2 text-white/70 text-sm">
            CS2 • 1v1 • 20 участников
            {startsLabel ? (
              <>
                {" "}• Старт: <span className="text-white/90 font-semibold">{startsLabel} (МСК)</span>
              </>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
              <div className="text-white/55 text-xs">Слоты</div>
              <div className="text-white font-extrabold mt-1">{t ? `${t.players ?? 0}/${t.maxPlayers ?? 20}` : "—/20"}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
              <div className="text-white/55 text-xs">Статус</div>
              <div className="text-white font-extrabold mt-1">{t ? String(t.status).toUpperCase() : "—"}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 col-span-2">
              <div className="text-white/55 text-xs">До старта</div>
              <div className="text-white font-extrabold mt-1">
                {left == null ? "—" : formatCountdown(left)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {t ? (
            <Link
              href={`/arena/${t.id}`}
              className="inline-flex rounded-2xl px-6 py-3 btn-accent text-white font-semibold shadow-lg hover:brightness-110 active:brightness-95"
            >
              Открыть турнир
            </Link>
          ) : (
            <Link
              href="/arena/tournaments"
              className="inline-flex rounded-2xl px-6 py-3 bg-white/10 text-white/80 font-semibold border border-white/12 hover:bg-white/15"
            >
              Турниры Arena →
            </Link>
          )}

          <div className="text-white/55 text-sm">
            * Баннер можно заменить на свой арт.
          </div>
        </div>
      </div>
    </div>
  );
}

function Inner() {
  const sp = useSearchParams();
  const initial = sp.get("tab") === "daily" ? "daily" : "monthly";
  const [tab, setTab] = useState<"daily" | "monthly">(initial);

  const card = useMemo(() => {
    if (tab === "daily") {
      return {
        title: "Ежедневный турнир",
        subtitle: "Robinson",
        prize: "$150 призовой фонд",
      };
    }
    return {
      title: "Ежемесячный турнир",
      subtitle: "Robinson",
      prize: "$3000 призовой фонд",
    };
  }, [tab]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-3xl font-extrabold text-white">Турниры</div>
          <div className="mt-2 text-white/60">Ежедневные и ежемесячные турниры в стиле BeavBet.</div>
        </div>

        <Link href="/" className="text-sm text-white/60 hover:text-white/90">
          На главную →
        </Link>
      </div>

      {/* Streamer tournament */}
      <StreamerTournamentCard />

      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab("monthly")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            tab === "monthly"
              ? "bg-white/10 text-white"
              : "bg-white/5 text-white/60 hover:text-white/90"
          }`}
        >
          Ежемесячные
        </button>

        <button
          onClick={() => setTab("daily")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            tab === "daily"
              ? "bg-white/10 text-white"
              : "bg-white/5 text-white/60 hover:text-white/90"
          }`}
        >
          Ежедневные
        </button>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <div className="text-white/60 text-sm">{card.subtitle}</div>
        <div className="mt-2 text-3xl font-extrabold text-white leading-tight">{card.title}</div>
        <div className="mt-2 text-white/70 text-lg font-semibold">{card.prize}</div>

        <div className="mt-6 inline-flex rounded-2xl px-6 py-3 btn-accent text-white font-semibold shadow-lg hover:brightness-110 active:brightness-95">
          Играть
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  // useSearchParams requires Suspense
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
