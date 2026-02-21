"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ArenaShell from "../../ArenaShell";
import { useParams } from "next/navigation";
import { cn } from "@/components/utils/cn";

function CopyRow({ label, value }: { label: string; value: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      alert("Скопировано");
    } catch {
      alert(value);
    }
  }
  return (
    <ArenaShell>
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/20 border border-white/10 px-4 py-3">
      <div className="min-w-0">
        <div className="text-white/50 text-xs">{label}</div>
        <div className="text-white/90 text-sm font-mono truncate">{value}</div>
      </div>
      <button onClick={copy} className="shrink-0 px-3 py-2 rounded-xl cs2-btn-ghost text-xs text-white/85">
        Copy
      </button>
    </div>
    </ArenaShell>
  );
}

export default function ArenaMatchPage() {
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [match, setMatch] = useState<any>(null);
  const [busy, setBusy] = useState<"win" | "lose" | null>(null);
  const [readyBusy, setReadyBusy] = useState(false);

  async function load() {
    // reuse my-matches list and pick by id (fast MVP)
    const r = await fetch("/api/arena/my-matches", { cache: "no-store", credentials: "include" });
    const j = await r.json().catch(() => ({}));
    const found = (j?.matches ?? []).find((x: any) => x.id === id);
    setMatch(found || null);
  }

  useEffect(() => {
    if (id) load();
    // refresh every 5s while open
    const t = setInterval(() => load(), 5000);
    return (
    <ArenaShell>) => clearInterval(t);
  }, [id]);

  async function report(result: "win" | "lose") {
    setBusy(result);
    const r = await fetch("/api/arena/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: id, result }),
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

  async function setReady(ready: boolean) {
    setReadyBusy(true);
    const r = await fetch("/api/arena/ready", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: id, ready }),
      credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    setReadyBusy(false);
    if (!r.ok) {
      alert(j?.error || "Ошибка");
      return;
    }
    await load();
  }

  if (!match) {
    return (
    <ArenaShell>
      <div className="mx-auto max-w-[980px] px-4 py-6 text-white/60">
        Матч не найден (или ты не участник).
        <div className="mt-4">
          <Link href="/arena/matches" className="px-4 py-2 rounded-2xl cs2-btn-ghost text-sm text-white/85">
            Назад
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ArenaShell>
    <div className="mx-auto max-w-[980px] px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-white text-2xl font-extrabold">Match Room</div>
          <div className="mt-1 text-white/60 text-sm">
            {match.game} • {match.title} • Round {match.round}
          </div>
        </div>
        <Link href="/arena/matches" className="px-4 py-2 rounded-2xl cs2-btn-ghost text-sm text-white/85">
          Мои матчи
        </Link>
      </div>

      <div className="mt-6 rounded-3xl cs2-panel-dark p-5">
        <div className="text-white/85 font-semibold">
          {match.p1_nick || match.p1_user_id?.slice(0, 6)} vs {match.p2_nick || match.p2_user_id?.slice(0, 6)}
        </div>
        <div className="mt-1 text-white/60 text-sm">Entry: {match.entry_fee} {match.currency}</div>

        {/* CS2 connect / launch (MVP) */}
        {(match.game || match.game === "") && String(match.game).toUpperCase() === "CS2" && (
          <div className="mt-5 grid gap-3">
            <div className="text-white/85 font-semibold">Как сыграть (CS2)</div>
            <div className="text-white/60 text-sm leading-relaxed">
              1) Оба нажимают <b>Ready</b> ниже. 2) Открывайте CS2. 3) Подключайтесь на сервер и сыграйте BO1 на карте ниже.
              После матча оба репортят результат.
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <a
                href="steam://run/730"
                className="py-3 rounded-2xl font-semibold text-center btn-accent"
              >
                OPEN CS2
              </a>
              {match.join_link ? (
                <a
                  href={match.join_link}
                  className="py-3 rounded-2xl font-semibold text-center bg-white/8 border border-white/10 hover:bg-white/10 text-white"
                >
                  CONNECT
                </a>
              ) : (
                <div className="py-3 rounded-2xl font-semibold text-center bg-white/6 border border-white/10 text-white/55">
                  CONNECT (нужен сервер)
                </div>
              )}
            </div>

            {match.server && <CopyRow label="Server" value={String(match.server)} />}
            {match.server_password && <CopyRow label="Password" value={String(match.server_password)} />}
            {match.map && <CopyRow label="Map" value={String(match.map)} />}

            {!match.server && (
              <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 text-yellow-200/90 text-sm">
                Сервер для CS2 пока не настроен. Добавь переменную окружения <b>ARENA_CS2_SERVERS</b> (пример: <span className="font-mono">1.2.3.4:27015;5.6.7.8:27015</span>),
                и матчи автоматически будут получать адрес сервера + deep-link.
              </div>
            )}
          </div>
        )}

        {/* Ready state */}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            disabled={readyBusy || match.status === "done"}
            onClick={() => setReady(true)}
            className={cn(
              "py-3 rounded-2xl font-semibold",
              (match.p1_ready || match.p2_ready) ? "bg-white/8 border border-white/10 hover:bg-white/10 text-white" : "cs2-btn-ghost text-white",
              readyBusy && "opacity-70"
            )}
          >
            READY
          </button>
          <button
            disabled={readyBusy || match.status === "done"}
            onClick={() => setReady(false)}
            className={cn(
              "py-3 rounded-2xl font-semibold",
              "cs2-btn-ghost text-white/85",
              readyBusy && "opacity-70"
            )}
          >
            NOT READY
          </button>
        </div>

        <div className="mt-2 text-white/55 text-xs">
          Статус матча: <b className="text-white/75">{match.status}</b> • Ready: {match.p1_ready ? "P1" : ""}{match.p2_ready ? " P2" : ""}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            disabled={busy !== null || match.status === "done"}
            onClick={() => report("win")}
            className={cn("py-3 rounded-2xl font-semibold", "btn-accent", busy === "win" && "opacity-70")}
          >
            I WON
          </button>
          <button
            disabled={busy !== null || match.status === "done"}
            onClick={() => report("lose")}
            className={cn(
              "py-3 rounded-2xl font-semibold",
              "bg-white/8 border border-white/10 hover:bg-white/10 text-white",
              busy === "lose" && "opacity-70"
            )}
          >
            I LOST
          </button>
        </div>

        <div className="mt-4 text-white/50 text-xs">
          Если оба игрока репортят одинаково (оба WIN/LOSE) — матч уйдёт в <b>Pending Review</b>.
        </div>
      </div>
    </div>
    </ArenaShell>
  );
}
