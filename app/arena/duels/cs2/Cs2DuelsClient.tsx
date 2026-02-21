"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/components/utils/cn";
import { Crosshair, Swords, Trophy, ShieldCheck, Copy, ExternalLink, Flame } from "lucide-react";

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

function fmtTime(ts: number) {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function MapBadge({ map }: { map?: string | null }) {
  const label = (map || "de_mirage").replace("de_", "").toUpperCase();
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-white/6 border border-white/12">
      <span className="h-2 w-2 rounded-full bg-accent cs2-status-dot" />
      <span className="tracking-[0.22em] text-white/80">{label}</span>
    </span>
  );
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      // light-touch: keep alert for now (no toast lib in project)
      alert("Скопировано");
    } catch {
      alert(value);
    }
  }
  return (
    <button
      onClick={copy}
      className="cs2-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/85 bg-white/6 border border-white/12 hover:bg-white/10"
      title={label}
    >
      <Copy className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = String(status || "").toLowerCase();
  const conf =
    s === "open"
      ? { text: "OPEN", dot: "bg-emerald-400", cls: "text-emerald-100" }
      : s === "active"
      ? { text: "LIVE", dot: "bg-accent", cls: "text-white" }
      : s === "reported"
      ? { text: "REPORTED", dot: "bg-yellow-300", cls: "text-yellow-100" }
      : s === "pending_review"
      ? { text: "REVIEW", dot: "bg-orange-300", cls: "text-orange-100" }
      : { text: s.toUpperCase(), dot: "bg-white/50", cls: "text-white/70" };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-black/30 border border-white/12",
        conf.cls
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", conf.dot)} />
      <span className="tracking-[0.22em]">{conf.text}</span>
    </span>
  );
}

export default function Cs2DuelsClient() {
  const [open, setOpen] = useState<Duel[]>([]);
  const [mine, setMine] = useState<Duel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const myLive = useMemo(() => mine.filter((d) => ["open", "active", "reported", "pending_review"].includes(String(d.status))), [mine]);

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
    <div className="cs2-shell">
      <div className="cs2-shell-bg" aria-hidden />
      <div className="cs2-fx" aria-hidden />
      <div className="cs2-noise" aria-hidden />

      <div className="relative z-10 mx-auto max-w-[1240px] px-4 py-6">
        {/* Top bar (in-game-like) */}
        <div className="cs2-panel-dark rounded-3xl px-4 py-3 md:px-5 md:py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/6 border border-white/10">
                <Crosshair className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-white font-extrabold tracking-[0.28em] text-sm">
                  CS2 <span className="text-accent">DUELS</span>
                </div>
                <div className="text-white/60 text-xs">
                  1v1 • ставки 5/10/20 • комиссия 15% от банка
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/arena"
                className="cs2-btn inline-flex items-center gap-2 rounded-2xl px-4 py-2 bg-white/6 border border-white/12 hover:bg-white/10 text-sm text-white/85"
              >
                ← Arena
              </Link>
            </div>
          </div>

          <div className="mt-3 cs2-divider" />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <span className="cs2-kbd rounded-xl px-3 py-2 text-xs text-white/80 inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span>Fair play: авто-банка + фикс. комиссия</span>
              </span>
              <span className="cs2-kbd rounded-xl px-3 py-2 text-xs text-white/80 inline-flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                <span>Победитель получает банк − fee</span>
              </span>
            </div>

            <button
              onClick={load}
              className="cs2-btn inline-flex items-center gap-2 rounded-2xl px-4 py-2 bg-white/6 border border-white/12 hover:bg-white/10 text-sm text-white/85"
            >
              Обновить
            </button>
          </div>
        </div>

        {/* Content grid */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Create + Tips */}
          <div className="lg:col-span-4">
            <div className="cs2-panel rounded-3xl p-4 md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-white font-extrabold text-lg">Создать дуэль</div>
                  <div className="mt-1 text-white/60 text-sm">
                    Выбери ставку — создадим лобби и откроем его для соперника.
                  </div>
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 border border-accent/25">
                  <Swords className="h-5 w-5 text-accent" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[5, 10, 20].map((s) => (
                  <button
                    key={s}
                    onClick={() => create(s)}
                    disabled={busy === "create"}
                    className={cn(
                      "cs2-btn cs2-btn-glow rounded-2xl px-4 py-3 font-extrabold",
                      "bg-accent text-black disabled:opacity-60"
                    )}
                  >
                    {busy === "create" ? "…" : `${s} EUR`}
                    <div className="mt-1 text-[11px] font-semibold text-black/70 tracking-[0.16em]">
                      STAKE
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-2xl bg-black/30 border border-white/10 p-4">
                <div className="text-white/80 font-semibold text-sm inline-flex items-center gap-2">
                  <Flame className="h-4 w-4 text-accent" />
                  Быстрый старт
                </div>
                <ol className="mt-2 space-y-2 text-sm text-white/60 list-decimal list-inside">
                  <li>Создай дуэль или прими открытую.</li>
                  <li>Зайди на сервер по Steam-ссылке или вручную.</li>
                  <li>После игры оба игрока подтверждают результат.</li>
                </ol>
              </div>
            </div>

            <div className="mt-4 cs2-panel-dark rounded-3xl p-4 md:p-5">
              <div className="text-white/85 font-semibold text-sm">Навигация</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href="/arena"
                  className="cs2-btn rounded-2xl px-4 py-3 bg-white/6 border border-white/12 hover:bg-white/10 text-sm text-white/85"
                >
                  Arena Home
                </Link>
                <Link
                  href="/arena/matches"
                  className="cs2-btn rounded-2xl px-4 py-3 bg-white/6 border border-white/12 hover:bg-white/10 text-sm text-white/85"
                >
                  Мои матчи
                </Link>
              </div>
              <div className="mt-3 text-xs text-white/55">
                Дальше добавим: matchmaking, рейтинги, анти-чит чек, демо и авто-верификацию результата.
              </div>
            </div>
          </div>

          {/* Right: Lists */}
          <div className="lg:col-span-8">
            {/* My duels */}
            <div className="cs2-panel rounded-3xl p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white font-extrabold text-lg">Мои дуэли</div>
                  <div className="mt-1 text-white/60 text-sm">
                    Активные лобби и подтверждение результата.
                  </div>
                </div>
                <span className="text-white/60 text-sm">{loading ? "…" : `${myLive.length} шт.`}</span>
              </div>

              <div className="mt-4 cs2-divider" />

              {loading ? (
                <div className="mt-4 text-white/60">Загрузка…</div>
              ) : myLive.length === 0 ? (
                <div className="mt-4 text-white/60">Нет активных дуэлей</div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {myLive.map((d) => {
                    const canReport = String(d.status).toLowerCase() === "active" || String(d.status).toLowerCase() === "reported" || String(d.status).toLowerCase() === "pending_review";
                    const serverLine =
                      d.server ? `${d.server}${d.server_password ? " / " + d.server_password : ""}` : "Server ещё не назначен (ARENA_CS2_SERVERS)";
                    return (
                      <div key={d.id} className="rounded-3xl bg-black/25 border border-white/10 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill status={d.status} />
                              <MapBadge map={d.map} />
                              <span className="text-white font-extrabold">
                                {d.stake} {d.currency}
                              </span>
                              <span className="text-white/40">•</span>
                              <span className="text-white/70 text-sm">
                                {fmtTime(d.updated_at)}
                              </span>
                            </div>

                            <div className="mt-2 text-sm text-white/70">
                              <span className="text-white/50">Players:</span>{" "}
                              <span className="text-white/85 font-semibold">{d.p1_nick || "Player1"}</span>{" "}
                              <span className="text-white/40">vs</span>{" "}
                              <span className="text-white/85 font-semibold">{d.p2_nick || "Waiting…"}</span>
                            </div>

                            <div className="mt-1 text-xs text-white/55 truncate">
                              <span className="text-white/45">Server:</span> {serverLine}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {d.server ? <CopyBtn value={String(d.server)} label="IP" /> : null}
                              {d.server_password ? <CopyBtn value={String(d.server_password)} label="PASS" /> : null}
                              {d.join_link ? (
                                <a
                                  className="cs2-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-black font-extrabold bg-accent cs2-btn-glow"
                                  href={d.join_link}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  JOIN
                                </a>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => report(d.id, "win")}
                              disabled={!canReport || busy === d.id + ":win"}
                              className={cn(
                                "cs2-btn rounded-2xl px-4 py-3 text-sm font-extrabold",
                                "bg-white/8 border border-white/14 hover:bg-white/12 text-white",
                                (!canReport || busy === d.id + ":win") && "opacity-60"
                              )}
                            >
                              {busy === d.id + ":win" ? "…" : "Я выиграл"}
                            </button>
                            <button
                              onClick={() => report(d.id, "lose")}
                              disabled={!canReport || busy === d.id + ":lose"}
                              className={cn(
                                "cs2-btn rounded-2xl px-4 py-3 text-sm font-extrabold",
                                "bg-white/8 border border-white/14 hover:bg-white/12 text-white",
                                (!canReport || busy === d.id + ":lose") && "opacity-60"
                              )}
                            >
                              {busy === d.id + ":lose" ? "…" : "Я проиграл"}
                            </button>
                          </div>
                        </div>

                        {String(d.status).toLowerCase() === "pending_review" ? (
                          <div className="mt-3 text-orange-200 text-sm">
                            Результаты не совпали — требуется разбор (пока вручную).
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Open duels */}
            <div className="mt-4 cs2-panel rounded-3xl p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white font-extrabold text-lg">Открытые дуэли</div>
                  <div className="mt-1 text-white/60 text-sm">
                    Нажми ACCEPT — ставка спишется и дуэль станет активной.
                  </div>
                </div>
                <span className="text-white/60 text-sm">{loading ? "…" : `${open.length} шт.`}</span>
              </div>

              <div className="mt-4 cs2-divider" />

              {loading ? (
                <div className="mt-4 text-white/60">Загрузка…</div>
              ) : open.length === 0 ? (
                <div className="mt-4 text-white/60">Нет открытых дуэлей</div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {open.map((d) => (
                    <div key={d.id} className="rounded-3xl bg-black/25 border border-white/10 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill status={d.status} />
                            <MapBadge map={d.map} />
                            <span className="text-white font-extrabold">
                              {d.stake} {d.currency}
                            </span>
                          </div>
                          <div className="mt-2 text-white/65 text-sm">
                            Создал: <span className="text-white/85 font-semibold">{d.p1_nick || "Player"}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => join(d.id)}
                          disabled={busy === d.id}
                          className={cn(
                            "cs2-btn cs2-btn-glow rounded-2xl px-5 py-3 font-extrabold",
                            "bg-accent text-black disabled:opacity-60"
                          )}
                        >
                          {busy === d.id ? "…" : "ACCEPT"}
                          <div className="mt-1 text-[11px] font-semibold text-black/70 tracking-[0.18em]">
                            JOIN MATCH
                          </div>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 text-xs text-white/45">
              ⚙️ Мы специально делаем UI «как будто ты в CS2». Следующий шаг — настоящий CS2 flow: ready-check, таймеры,
              auto-cancel, live status, и интеграция с серверами через RCON/Matchmaking.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
