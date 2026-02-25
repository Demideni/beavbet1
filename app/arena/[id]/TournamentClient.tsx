"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}д ${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
}

import ArenaShell from "../ArenaShell";
import { useParams } from "next/navigation";
import { cn } from "@/components/utils/cn";

export default function TournamentClient() {
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);

  async function load() {
    const r = await fetch(`/api/arena/tournaments/${id}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setData(j);
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function join() {
    setBusy(true);
    const r = await fetch("/api/arena/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: id }),
      credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      alert(j?.error || "Ошибка");
      return;
    }
    window.dispatchEvent(new Event("wallet:refresh"));
    await load();
  }

  const t = data?.tournament;
  const startsLabel = useMemo(() => {
    if (!t?.startsAt) return null;
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

  useEffect(() => {
    if (!t?.startsAt) return;
    const tick = () => setLeft(Math.max(0, Number(t.startsAt) - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [t?.startsAt]);

  const participants = data?.participants ?? [];
  const matches = data?.matches ?? [];

  if (!t) {
    return (
      <ArenaShell>
        <div className="mx-auto max-w-[980px] px-4 py-6 text-white/60">
          Загрузка…
        </div>
      </ArenaShell>
    );
  }

  const prizePool = Number((t.entryFee * t.maxPlayers * (1 - t.rake)).toFixed(2));

  return (
    <ArenaShell>
    <div className="mx-auto max-w-[980px] px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-white text-2xl font-extrabold">{t.game} • {t.title}</div>
          <div className="mt-1 text-white/60 text-sm">
            Entry: <span className="text-white/85 font-semibold">{t.entryFee} {t.currency}</span> • Players: <span className="text-white/85 font-semibold">{participants.length}/{t.maxPlayers}</span> • Prize pool: <span className="text-white/85 font-semibold">{prizePool} {t.currency}</span>
          </div>
        </div>
        {t.startsAt ? (
          <div className="mt-3 grid grid-cols-2 gap-2 max-w-[520px]">
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
              <div className="text-white/55 text-xs">Старт</div>
              <div className="text-white font-extrabold mt-1">{startsLabel ? `${startsLabel} (МСК)` : "—"}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
              <div className="text-white/55 text-xs">До старта</div>
              <div className="text-white font-extrabold mt-1">{left == null ? "—" : formatCountdown(left)}</div>
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Link
            href="/arena"
            className="px-4 py-2 rounded-2xl cs2-btn-ghost text-sm text-white/85"
          >
            Назад
          </Link>
          <button
            disabled={t.status !== "open" || busy}
            onClick={join}
            className={cn(
              "px-4 py-2 rounded-2xl text-sm font-semibold",
              t.status === "open" ? "btn-accent" : "bg-white/10 text-white/40",
              busy && "opacity-70"
            )}
          >
            {t.status === "open" ? (busy ? "…" : "JOIN") : t.status.toUpperCase()}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl cs2-panel-dark p-4">
          <div className="text-white font-semibold">Участники</div>
          <div className="mt-3 space-y-2">
            {participants.length === 0 ? (
              <div className="text-white/60 text-sm">Пока никого</div>
            ) : (
              participants.map((p: any) => (
                <div key={p.user_id} className="flex items-center justify-between text-sm">
                  <div className="text-white/85">{p.nickname || p.user_id.slice(0, 6)}</div>
                  <div className="text-white/45">{p.status}</div>
                </div>
              ))
            )}
            <div className="pt-2 text-white/50 text-xs">{participants.length}/{t.maxPlayers} slots</div>
          </div>
        </div>

        <div className="rounded-3xl cs2-panel-dark p-4">
          <div className="text-white font-semibold">Сетка</div>
          <div className="mt-3 space-y-2">
            {matches.length === 0 ? (
              <div className="text-white/60 text-sm">Сетка появится когда турнир заполнится</div>
            ) : (
              matches.map((m: any) => (
                <Link
                  key={m.id}
                  href={`/arena/match/${m.id}`}
                  className="block rounded-2xl border border-white/10 bg-white/5 hover:bg-white/8 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-white/85">Round {m.round}: {m.p1_nick || m.p1_user_id.slice(0, 6)} vs {m.p2_nick || m.p2_user_id.slice(0, 6)}</div>
                    <div className="text-xs text-white/45">{m.status}</div>
                  </div>
                  {m.winner_user_id ? (
                    <div className="mt-1 text-xs text-white/60">Winner: {m.winner_nick || m.winner_user_id.slice(0, 6)}</div>
                  ) : null}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
    </ArenaShell>
  );
}
