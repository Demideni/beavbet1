"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ArenaShell from "../../ArenaShell";

type DuelPlayer = { user_id: string; team: number; is_captain: number; ready: number };

type Duel = {
  id: string;
  mode: string;
  team_size: number;
  stake: number;
  currency: string;
  status: string;
  map?: string | null;
  server?: string | null;
  server_password?: string | null;
  join_link?: string | null;
  p1_user_id: string;
  p1_nick?: string | null;
  p2_user_id?: string | null;
  p2_nick?: string | null;
  winner_user_id?: string | null;
  winner_team?: number | null;
  ready_deadline?: number | null;
  live_state?: string | null;
  players?: DuelPlayer[];
  team1_count?: number;
  team2_count?: number;
};

export default function Cs2DuelsClient() {
  const [open, setOpen] = useState<Duel[]>([]);
  const [mine, setMine] = useState<Duel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [teamSize, setTeamSize] = useState<number>(1);
  const [map, setMap] = useState<string>("random");
  const [stakePreset, setStakePreset] = useState<number>(5);
  const [customStake, setCustomStake] = useState<string>("");
  const [myRating, setMyRating] = useState<{ dam_rank: number; matches: number; wins: number; losses: number } | null>(null);
  const [ratingName, setRatingName] = useState<string>("DamRank");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/arena/duels/cs2/list", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setOpen(j?.open ?? []);
    setMine(j?.mine ?? []);
    setMyRating(j?.myRating ?? null);
    if (j?.ratingName) setRatingName(String(j.ratingName));
    setLoading(false);
  }

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    load();

    // Live updates (SSE). If SSE fails, we still keep manual refresh buttons.
    try {
      const es = new EventSource('/api/arena/duels/cs2/stream');
      es.addEventListener('duels', (e: any) => {
        try {
          const data = JSON.parse(e?.data || '{}');
          setOpen(data?.open ?? []);
          setMine(data?.mine ?? []);
        } catch {}
      });
      es.onerror = () => {
        try { es.close(); } catch {}
      };
      return () => {
        try { es.close(); } catch {}
      };
    } catch {
      return;
    }
  }, []);

  async function create() {
    const stake = customStake.trim() ? Number(customStake) : stakePreset;
    if (!Number.isFinite(stake) || stake < 1 || stake > 1000) {
      alert("Некорректная ставка (1 - 1000 EUR)");
      return;
    }
    setBusy("create");
    const r = await fetch("/api/arena/duels/cs2/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stake: customStake.trim() ? Number(customStake) : stakePreset, currency: "EUR", teamSize, map }),
      credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) {
      alert(j?.error || "Ошибка");
      return;
    }
    window.dispatchEvent(new Event("wallet:refresh"));
    await load();
  }
  async function ready(duelId: string, team?: number) {
    setBusy(`ready:${duelId}`);
    const r = await fetch("/api/arena/duels/cs2/ready", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duelId, team }),
      credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) {
      alert(j?.error || "Ошибка");
      return;
    }
    await load();
  }


  async function join(duelId: string, team?: number) {
    setBusy(duelId);
    const r = await fetch("/api/arena/duels/cs2/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duelId, team }),
      credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) {
      alert(j?.error || "Ошибка");
      return;
    }
    window.dispatchEvent(new Event("wallet:refresh"));
    await load();
  }

  async function report(duelId: string, result: "win" | "lose") {
    setBusy(duelId + ":" + result);
    const r = await fetch("/api/arena/duels/cs2/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duelId, result }),
      credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) {
      alert(j?.error || "Ошибка");
      return;
    }
    window.dispatchEvent(new Event("wallet:refresh"));
    await load();
  }

  return (
    <ArenaShell>
    <div className="mx-auto max-w-[980px] px-4 py-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-white text-3xl font-extrabold">CS2 Duels</div>
          <div className="mt-1 text-white/60 text-sm">
            Дуэли {teamSize}v{teamSize} • комиссия 15% от банка
          </div>
          {myRating ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-1.5 text-sm text-white/85">
              <span className="text-white/60">{ratingName}:</span>
              <span className="font-extrabold text-white">{myRating.dam_rank}</span>
              <span className="text-white/45">•</span>
              <span className="text-white/60">W</span><span className="font-semibold">{myRating.wins}</span>
              <span className="text-white/60">L</span><span className="font-semibold">{myRating.losses}</span>
            </div>
          ) : null}
        </div>
        <Link
          href="/arena"
          className="cs2-btn-ghost text-sm"
        >
          ← Назад в Arena
        </Link>
      </div>

      
      <div className="mt-6 rounded-3xl bg-white/5 border border-white/10 p-4">
        <div className="text-white font-semibold">Создать дуэль</div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Team size */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-white/70 text-xs font-semibold tracking-wide">ФОРМАТ</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1,2,3,4,5].map((n) => (
                <button
                  key={n}
                  onClick={() => setTeamSize(n)}
                  className={
                    "px-3 py-2 rounded-xl border text-sm font-bold transition " +
                    (teamSize === n
                      ? "bg-accent text-black border-accent"
                      : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10")
                  }
                >
                  {n}v{n}
                </button>
              ))}
            </div>
            <div className="mt-2 text-white/50 text-xs">
              1 дуэль на игрока. Комиссия 15% от банка.
            </div>
          </div>

          {/* Map */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-white/70 text-xs font-semibold tracking-wide">КАРТА</div>
            <select
              value={map}
              onChange={(e) => setMap(e.target.value)}
              className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white/90"
            >
              <option value="random">Random</option>
              {["de_mirage","de_inferno","de_ancient","de_nuke","de_anubis","de_overpass","de_vertigo"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <div className="mt-2 text-white/50 text-xs">
              Для server-режима карта будет выставлена автоматически.
            </div>
          </div>

          {/* Stake */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-white/70 text-xs font-semibold tracking-wide">СТАВКА (EUR)</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[5, 10, 20].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStakePreset(s);
                    setCustomStake("");
                  }}
                  className={
                    "px-3 py-2 rounded-xl border text-sm font-bold transition " +
                    (!customStake && stakePreset === s
                      ? "bg-accent text-black border-accent"
                      : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10")
                  }
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="mt-2">
              <input
                value={customStake}
                onChange={(e) => setCustomStake(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="Или своя ставка (1 - 1000)"
                className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white/90 placeholder:text-white/30"
              />
            </div>

            <div className="mt-2 text-white/50 text-xs">
              Банк = ставка × (кол-во игроков). Победная команда делит приз поровну.
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={() => create()}
            disabled={busy === "create"}
            className="px-5 py-3 rounded-2xl bg-accent text-black font-extrabold disabled:opacity-60"
          >
            {busy === "create" ? "Создаём..." : "Создать дуэль"}
          </button>

          <div className="text-white/55 text-sm">
            После заполнения команд появится ready-check на 60 секунд.
          </div>
        </div>
      </div>


      <div className="mt-6 grid gap-3">
        <div className="text-white/80 font-semibold">Мои активные</div>
        {loading ? (
          <div className="text-white/60">Загрузка…</div>
        ) : mine.length === 0 ? (
          <div className="text-white/60">Нет активных дуэлей</div>
        ) : (
          mine.map((d) => (
            <div key={d.id} className="cs2-panel-dark p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-white font-bold tracking-wide">
                    {d.status.toUpperCase()} • {d.stake} {d.currency} • {d.map || "map"}
                  </div>

                  {/* Ready-check */}
                  {(d.status === "active" && (d.live_state || "") === "readycheck") && (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-white/80 text-sm font-semibold tracking-[0.18em] uppercase">Ready check</div>
                        <div className="cs2-pill">
                          {Math.max(0, Math.ceil(((d.ready_deadline || 0) - nowTs) / 1000))}s
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-white/70 text-xs">P1</div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <div className="text-white font-semibold truncate">{d.p1_nick || d.p1_user_id.slice(0, 6)}</div>
                            <div className="cs2-pill">{d.p1_ready ? "READY" : "…"}</div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-white/70 text-xs">P2</div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <div className="text-white font-semibold truncate">{d.p2_nick || (d.p2_user_id ? d.p2_user_id.slice(0, 6) : "—")}</div>
                            <div className="cs2-pill">{d.p2_ready ? "READY" : "…"}</div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => ready(d.id)}
                          disabled={busy === `ready:${d.id}` || ((d.me_is_p1 ? d.p1_ready : d.p2_ready) ? true : false)}
                          className="cs2-btn disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {(d.me_is_p1 ? d.p1_ready : d.p2_ready) ? "READY ✓" : "READY"}
                        </button>
                        <div className="text-white/60 text-xs">
                          Если не нажать READY вовремя — дуэль отменится и ставки вернутся.
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="mt-1 text-white/60 text-sm">
                    {d.server ? (
                      <>
                        Server: <span className="text-white/80">{d.server}</span>
                        {d.server_password ? (
                          <>
                            {" "}• Pass: <span className="text-white/80">{d.server_password}</span>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>Server ещё не назначен (добавь ARENA_CS2_SERVERS)</>
                    )}
                  </div>
                  {d.join_link ? (
                    <a className="mt-2 inline-block text-accent underline" href={d.join_link}>
                      Подключиться через Steam
                    </a>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => report(d.id, "win")}
                    disabled={busy === d.id + ":win"}
                    className="px-4 py-2 rounded-2xl bg-white/10 border border-white/15 text-white hover:bg-white/15 disabled:opacity-60"
                  >
                    Я выиграл
                  </button>
                  <button
                    onClick={() => report(d.id, "lose")}
                    disabled={busy === d.id + ":lose"}
                    className="px-4 py-2 rounded-2xl bg-white/10 border border-white/15 text-white hover:bg-white/15 disabled:opacity-60"
                  >
                    Я проиграл
                  </button>
                </div>
              </div>
              {d.status === "pending_review" ? (
                <div className="mt-3 text-yellow-300 text-sm">
                  Результаты не совпали — требуется разбор (пока вручную).
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="mt-8 grid gap-3">
        <div className="text-white/80 font-semibold">Открытые дуэли</div>
        {loading ? (
          <div className="text-white/60">Загрузка…</div>
        ) : open.length === 0 ? (
          <div className="text-white/60">Нет открытых дуэлей</div>
        ) : (
          open.map((d) => (
            <div key={d.id} className="cs2-panel-dark p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-white">
                  <div className="font-bold">
                    {d.stake} {d.currency} • {d.map || "map"}
                  </div>
                  <div className="text-white/60 text-sm">Создал: {d.p1_nick || "Player"}</div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
  <div className="text-white/55 text-xs sm:text-sm text-right sm:text-left">
    {d.mode} • Team A {d.team1_count ?? 1}/{d.team_size} • Team B {d.team2_count ?? 0}/{d.team_size}
  </div>
  <div className="flex gap-2 justify-end">
    <button
      onClick={() => join(d.id, 1)}
      disabled={busy === d.id}
      className="px-4 py-2 rounded-2xl bg-white/10 border border-white/12 text-white/90 font-bold hover:bg-white/15 disabled:opacity-60"
    >
      {busy === d.id ? "..." : "В A"}
    </button>
    <button
      onClick={() => join(d.id, 2)}
      disabled={busy === d.id}
      className="px-4 py-2 rounded-2xl bg-accent text-black font-bold disabled:opacity-60"
    >
      {busy === d.id ? "..." : "В B"}
    </button>
  </div>
</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
    </ArenaShell>
  );
}
