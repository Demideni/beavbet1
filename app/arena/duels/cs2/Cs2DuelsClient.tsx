"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
};

export default function Cs2DuelsClient() {
  const [open, setOpen] = useState<Duel[]>([]);
  const [mine, setMine] = useState<Duel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/arena/duels/cs2/list", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setOpen(j?.open ?? []);
    setMine(j?.mine ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
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
    <div className="mx-auto max-w-[980px] px-4 py-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-white text-3xl font-extrabold">CS2 Duels</div>
          <div className="mt-1 text-white/60 text-sm">
            1v1 • ставки 5/10/20 • комиссия 15% (пока просто удерживается)
          </div>
        </div>
        <Link
          href="/arena"
          className="px-4 py-2 rounded-2xl bg-white/6 border border-white/10 hover:bg-white/10 text-sm text-white/85"
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
            <div key={d.id} className="rounded-3xl bg-white/5 border border-white/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-white font-bold">
                    {d.status.toUpperCase()} • {d.stake} {d.currency} • {d.map || "map"}
                  </div>
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
            <div key={d.id} className="rounded-3xl bg-white/5 border border-white/10 p-4">
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
  );
}
