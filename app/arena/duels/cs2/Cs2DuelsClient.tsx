"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ArenaShell from "../../ArenaShell";

type Duel = {
  id: string;
  stake: number;
  currency: string;
  status: string;
  map?: string | null;
  server?: string | null;
  server_password?: string | null;
  join_link?: string | null;
  p1_user_id: string;
  p2_user_id?: string | null;
  winner_user_id?: string | null;
  created_at: number;
  updated_at: number;
  p1_nick?: string | null;
  p2_nick?: string | null;
  winner_nick?: string | null;
  p1_ready?: number;
  p2_ready?: number;
  ready_deadline?: number | null;
  live_state?: string | null;
  me_is_p1?: number;
  match_token?: string | null;
  cancel_reason?: string | null;
};

export default function Cs2DuelsClient() {
  const [open, setOpen] = useState<Duel[]>([]);
  const [mine, setMine] = useState<Duel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState<number>(Date.now());

  async function load() {
    setLoading(true);
    const r = await fetch("/api/arena/duels/cs2/list", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setOpen(j?.open ?? []);
    setMine(j?.mine ?? []);
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

  async function create(stake: number) {
    setBusy("create");
    const r = await fetch("/api/arena/duels/cs2/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stake }),
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
  async function ready(duelId: string) {
    setBusy(`ready:${duelId}`);
    const r = await fetch("/api/arena/duels/cs2/ready", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duelId }),
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


  async function join(duelId: string) {
    setBusy(duelId);
    const r = await fetch("/api/arena/duels/cs2/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duelId }),
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
            1v1 • ставки 5/10/20 • комиссия 15% от банка
          </div>
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
        <div className="mt-3 flex gap-3">
          {[5, 10, 20].map((s) => (
            <button
              key={s}
              onClick={() => create(s)}
              disabled={busy === "create"}
              className="px-4 py-2 rounded-2xl bg-accent text-black font-bold disabled:opacity-60"
            >
              {busy === "create" ? "..." : `Ставка ${s}`}
            </button>
          ))}
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
                <button
                  onClick={() => join(d.id)}
                  disabled={busy === d.id}
                  className="px-4 py-2 rounded-2xl bg-accent text-black font-bold disabled:opacity-60"
                >
                  {busy === d.id ? "..." : "Принять"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
    </div>
    </ArenaShell>
  );
}
