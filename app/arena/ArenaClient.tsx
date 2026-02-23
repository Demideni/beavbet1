"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/components/utils/cn";
import ArenaShell from "./ArenaShell";
import { Crosshair, Swords, Trophy, Flame, Wallet, ListOrdered, User } from "lucide-react";

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

type DuelCard = {
  id: string;
  game: string;
  stake: number;
  currency: string;
  status: string;
  map?: string | null;
  p1_nick?: string | null;
  p2_nick?: string | null;
  updated_at: number;
};

type ActivityItem = {
  id: string;
  kind: "duel_done" | "duel_open" | "duel_active";
  game: string;
  stake: number;
  currency: string;
  p1_nick?: string | null;
  p2_nick?: string | null;
  winner_nick?: string | null;
  at: number;
};

export default function ArenaClient() {
  const { t } = useI18n();
  const [items, setItems] = useState<T[]>([]);
  const [openDuels, setOpenDuels] = useState<DuelCard[]>([]);
  const [myDuels, setMyDuels] = useState<DuelCard[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [myRating, setMyRating] = useState<number>(1000);
  const [ratingName, setRatingName] = useState<string>("Bronze");

  async function load() {
    setLoading(true);
    const [tr, dr, ar] = await Promise.all([
      fetch("/api/arena/tournaments", { cache: "no-store" }),
      fetch("/api/arena/duels/cs2/list", { cache: "no-store" }),
      fetch("/api/arena/activity", { cache: "no-store" }),
    ]);

    const tj = await tr.json().catch(() => ({}));
    const dj = await dr.json().catch(() => ({}));
    const aj = await ar.json().catch(() => ({}));

    setItems(tj?.tournaments ?? []);
    setOpenDuels(dj?.open ?? []);
    setMyDuels(dj?.mine ?? []);
    setMyRating(Number(dj?.myRating?.dam_rank ?? 1000));
    setRatingName(String(dj?.ratingName ?? "Bronze"));
    setActivity(aj?.items ?? []);
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

  function prettyTime(ts: number) {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  }

  return (
    <ArenaShell>
      <div className="relative">
        <div className="relative z-10">
          {/* Top hero */}
          <section className="relative">
            <div
              className="absolute -top-24 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
              aria-hidden
            />

            <div className="relative mx-auto max-w-[1280px] px-4 pt-10 pb-6">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/35 px-5 py-2">
                    <span className="text-white font-extrabold tracking-[0.32em] text-sm">
                      BEAV<span className="text-accent">BET</span>
                    </span>
                    <span className="h-4 w-px bg-white/15" />
                    <span className="text-white/70 text-sm">ARENA</span>
                  </div>
                  <h1 className="mt-6 text-3xl md:text-4xl font-extrabold text-white">Duels • Tournaments • Ladder</h1>
                  <p className="mt-2 text-white/65 max-w-[720px]">
                    {t("arena.hero.subtitle")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link href="/arena/duels/cs2" className="px-6 py-3 rounded-2xl btn-accent text-black font-extrabold">
                    Create / Join duel
                  </Link>
                  <Link
                    href="/arena/profile"
                    className="px-6 py-3 rounded-2xl bg-white/6 border border-white/12 hover:bg-white/10 text-white/90 font-semibold"
                  >
                    My profile
                  </Link>
                  <Link
                    href="/arena/leaderboard"
                    className="px-6 py-3 rounded-2xl bg-white/6 border border-white/12 hover:bg-white/10 text-white/90 font-semibold"
                  >
                    Leaderboard
                  </Link>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-3xl card-glass p-5 flex items-center justify-between relative overflow-hidden">
                  <div>
                    <div className="text-white/60 text-sm flex items-center gap-2">
                      <Image src="/brand/beavrank.png" alt="BeavRank" width={16} height={16} className="opacity-90" />
                      {t("arena.beavrank")}
                    </div>
                    <div className="text-white text-2xl font-extrabold mt-1">{myRating}</div>
                    <div className="text-white/70 text-sm mt-1">{ratingName}</div>
                  </div>
                  <div className="relative h-full w-[96px] shrink-0">
                    <Image
                      src="/arena/cards/beavrank.png"
                      alt="BeavRank"
                      fill
                      className="object-contain opacity-90"
                      sizes="96px"
                    />
                  </div>
                </div>

                <div className="rounded-3xl card-glass p-5 flex items-center justify-between relative overflow-hidden">
                  <div>
                    <div className="text-white/60 text-sm">Open duels</div>
                    <div className="text-white text-2xl font-extrabold mt-1">{openDuels.length}</div>
                    <div className="text-white/70 text-sm mt-1">CS2 • 1v1</div>
                  </div>
                  <div className="relative h-full w-[96px] shrink-0">
                    <Image
                      src="/arena/cards/open-duels.png"
                      alt="Open duels"
                      fill
                      className="object-contain opacity-90"
                      sizes="96px"
                    />
                  </div>
                </div>

                <div className="rounded-3xl card-glass p-5 flex items-center justify-between relative overflow-hidden">
                  <div>
                    <div className="text-white/60 text-sm">Today prize pool</div>
                    <div className="text-white text-2xl font-extrabold mt-1">€{todayPool.toFixed(0)}</div>
                    <div className="text-white/70 text-sm mt-1">Tournaments</div>
                  </div>
                  <div className="relative h-full w-[96px] shrink-0">
                    <Image
                      src="/arena/cards/tournaments.png"
                      alt="Tournaments"
                      fill
                      className="object-contain opacity-90"
                      sizes="96px"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3-column dashboard */}
          <section className="mx-auto max-w-[1280px] px-4 pb-12">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-3">
              {/* Left nav */}
              <aside className="rounded-3xl card-glass p-4 h-fit">
                <div className="text-white font-semibold">Games</div>
                <div className="mt-3 grid gap-2">
                  <Link
                    href="/arena/duels/cs2"
                    className="rounded-2xl px-3 py-2 bg-white/6 border border-white/10 hover:bg-white/10 text-white/90 flex items-center gap-2"
                  >
                    <Crosshair className="h-4 w-4" /> CS2 Duels
                  </Link>
                  <div className="rounded-2xl px-3 py-2 bg-white/4 border border-white/8 text-white/45 flex items-center gap-2">
                    <Swords className="h-4 w-4" /> Dota 2 (soon)
                  </div>
                  <div className="rounded-2xl px-3 py-2 bg-white/4 border border-white/8 text-white/45 flex items-center gap-2">
                    <Trophy className="h-4 w-4" /> Tournaments
                  </div>
                </div>

                <div className="mt-6 text-white font-semibold">Quick links</div>
                <div className="mt-3 grid gap-2">
                  <Link
                    href="/arena/matches"
                    className="rounded-2xl px-3 py-2 bg-white/6 border border-white/10 hover:bg-white/10 text-white/90 flex items-center gap-2"
                  >
                    <ListOrdered className="h-4 w-4" /> My matches
                  </Link>
                  <Link
                    href="/arena/profile"
                    className="rounded-2xl px-3 py-2 bg-white/6 border border-white/10 hover:bg-white/10 text-white/90 flex items-center gap-2"
                  >
                    <User className="h-4 w-4" /> Profile
                  </Link>
                </div>
              </aside>

              {/* Center */}
              <main className="grid gap-3">
                <div className="rounded-3xl card-glass p-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-white text-xl font-extrabold">Active duels</div>
                      <div className="text-white/60 text-sm mt-1">{t("arena.activeDuels.subtitle")}</div>
                    </div>
                    <Link href="/arena/duels/cs2" className="text-white/80 hover:text-white text-sm">
                      Open all →
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {loading ? (
                      <div className="text-white/60">{t("common.loading")}</div>
                    ) : openDuels.length === 0 ? (
                      <div className="text-white/60">{t("arena.noOpenDuels")}</div>
                    ) : (
                      openDuels.slice(0, 6).map((d) => (
                        <Link
                          key={d.id}
                          href={`/arena/duels/cs2/${d.id}`}
                          className="rounded-3xl bg-black/25 border border-white/10 hover:border-white/18 px-4 py-3 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-white font-semibold">
                              {d.p1_nick || "Player"} <span className="text-white/35">vs</span> {d.p2_nick || "Waiting…"}
                            </div>
                            <div className="text-white/55 text-sm mt-1">CS2 • {d.map || "Map"} • {prettyTime(d.updated_at)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-extrabold">
                              {d.stake} {d.currency}
                            </div>
                            <div className="text-white/55 text-sm">Join</div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl card-glass p-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-white text-xl font-extrabold">Tournaments</div>
                      <div className="text-white/60 text-sm mt-1">Входной взнос формирует призовой фонд.</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {loading ? (
                      <div className="text-white/60">{t("common.loading")}</div>
                    ) : visible.length === 0 ? (
                      <div className="text-white/60">Нет турниров</div>
                    ) : (
                      visible.slice(0, 4).map((t) => {
                        const pct = Math.round((t.players / t.maxPlayers) * 100);
                        const isOpen = t.status === "open";
                        return (
                          <div key={t.id} className="rounded-3xl bg-black/25 border border-white/10 px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-white font-semibold">
                                  {t.game} • {t.title}
                                </div>
                                <div className="mt-1 text-white/60 text-sm">
                                  Entry <span className="text-white/85 font-semibold">{t.entryFee} {t.currency}</span> • {t.players}/{t.maxPlayers}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/arena/${t.id}`}
                                  className="px-4 py-2 rounded-2xl bg-white/6 border border-white/10 hover:bg-white/10 text-sm text-white/85"
                                >
                                  Open
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
                </div>
              </main>

              {/* Right */}
              <aside className="grid gap-3 h-fit">
                <div className="rounded-3xl card-glass p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-white font-semibold">Arena Wallet</div>
                    <div className="h-9 w-9 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center">
                      <Wallet className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="mt-3 text-white/65 text-sm">Баланс и депозит — в правом верхнем кошельке сайта.</div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href="/cashier"
                      className="rounded-2xl px-3 py-2 bg-white/6 border border-white/10 hover:bg-white/10 text-white/90 text-sm text-center"
                    >
                      Deposit
                    </Link>
                    <Link
                      href="/withdraw"
                      className="rounded-2xl px-3 py-2 bg-white/6 border border-white/10 hover:bg-white/10 text-white/90 text-sm text-center"
                    >
                      Withdraw
                    </Link>
                  </div>
                </div>

                <div className="rounded-3xl card-glass p-4">
                  <div className="text-white font-semibold">My duels</div>
                  <div className="mt-3 grid gap-2">
                    {loading ? (
                      <div className="text-white/60 text-sm">{t("common.loading")}</div>
                    ) : myDuels.length === 0 ? (
                      <div className="text-white/60 text-sm">Пока нет</div>
                    ) : (
                      myDuels.slice(0, 5).map((d) => (
                        <Link
                          key={d.id}
                          href={`/arena/duels/cs2/${d.id}`}
                          className="rounded-2xl px-3 py-2 bg-white/6 border border-white/10 hover:bg-white/10"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-white/90 text-sm font-semibold truncate">
                              {d.p1_nick || "P1"} vs {d.p2_nick || "P2"}
                            </div>
                            <div className="text-white font-extrabold text-sm">
                              {d.stake}
                              {d.currency}
                            </div>
                          </div>
                          <div className="text-white/55 text-xs mt-1">
                            {String(d.status).toUpperCase()} • {prettyTime(d.updated_at)}
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl card-glass p-4">
                  <div className="text-white font-semibold">Live activity</div>
                  <div className="mt-3 grid gap-2">
                    {activity.length === 0 ? (
                      <div className="text-white/60 text-sm">Пока пусто</div>
                    ) : (
                      activity.slice(0, 8).map((a) => (
                        <div key={a.id} className="rounded-2xl px-3 py-2 bg-white/5 border border-white/10">
                          <div className="text-white/85 text-sm">
                            {a.kind === "duel_done" ? (
                              <>
                                {a.winner_nick || "Player"} won {a.stake} {a.currency}
                              </>
                            ) : (
                              <>
                                Duel {a.stake} {a.currency} is {a.kind === "duel_open" ? "open" : "active"}
                              </>
                            )}
                          </div>
                          <div className="text-white/55 text-xs mt-1">{prettyTime(a.at)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </div>
    </ArenaShell>
  );
}
