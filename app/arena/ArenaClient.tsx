"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Crosshair, Trophy, Wallet, Users, ArrowRight } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/components/utils/cn";
import ArenaShell from "./ArenaShell";
import { TournamentHero } from "@/components/arena/TournamentHero";
import { featuredTournamentZava } from "@/components/arena/FeaturedTournamentData";

type Duel = {
  id: string;
  stake: number;
  currency: string;
  status: string;
  map?: string;
  p1_nick?: string;
  p2_nick?: string;
  updated_at: string;
};

type Tournament = {
  id: string;
  game: string;
  title: string;
  entryFee: number;
  currency: string;
  players: number;
  maxPlayers: number;
  status: "open" | "live" | "done";
};

type Activity = {
  id: string;
  kind: "duel_open" | "duel_active" | "duel_done";
  at: string;
  stake: number;
  currency: string;
  winner_nick?: string;
};

function prettyTime(ts: string) {
  try {
    const d = new Date(ts);
    const diff = Math.max(0, Date.now() - d.getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

export default function ArenaClient() {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [openDuels, setOpenDuels] = useState<Duel[]>([]);
  const [myDuels, setMyDuels] = useState<Duel[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [myRating, setMyRating] = useState(1000);
  const [ratingName, setRatingName] = useState("Silver");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/arena/dashboard", { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        setOpenDuels(Array.isArray(json?.openDuels) ? json.openDuels : []);
        setMyDuels(Array.isArray(json?.myDuels) ? json.myDuels : []);
        setTournaments(Array.isArray(json?.tournaments) ? json.tournaments : []);
        setActivity(Array.isArray(json?.activity) ? json.activity : []);
        if (typeof json?.myRating === "number") setMyRating(json.myRating);
        if (typeof json?.ratingName === "string") setRatingName(json.ratingName);
      } catch {
        // ignore
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const todayPool = useMemo(() => {
    try {
      return tournaments.reduce((sum, tt) => sum + (tt.status === "open" ? tt.entryFee * tt.players : 0), 0);
    } catch {
      return 0;
    }
  }, [tournaments]);

  const visible = useMemo(() => {
    const arr = Array.isArray(tournaments) ? tournaments : [];
    return arr.filter((x) => x && x.status !== "done");
  }, [tournaments]);

  async function join(tId: string) {
    setBusy(tId);
    try {
      const res = await fetch(`/api/arena/tournaments/${tId}/join`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed");
      // refresh dashboard lightly
      const r2 = await fetch("/api/arena/dashboard", { cache: "no-store" });
      const j2 = await r2.json();
      setOpenDuels(Array.isArray(j2?.openDuels) ? j2.openDuels : []);
      setMyDuels(Array.isArray(j2?.myDuels) ? j2.myDuels : []);
      setTournaments(Array.isArray(j2?.tournaments) ? j2.tournaments : []);
    } catch (e: any) {
      alert(e?.message || "Join failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ArenaShell>
      {/* FACEIT-like structure inside our shell */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        {/* Center */}
        <main className="min-w-0">
          {/* Big banner */}
          <div className="rounded-3xl overflow-hidden border border-white/10 bg-black/30 relative">
            <div className="absolute inset-0 opacity-40">
              <Image
                src="/arena/cards/tournaments.png"
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 900px"
                priority
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />
            <div className="relative p-5 md:p-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/7 border border-white/10 grid place-items-center">
                  <Crosshair className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-white/70 text-xs font-semibold tracking-[0.18em] uppercase">CS2</div>
                  <div className="text-white text-lg font-extrabold">Подключить игру</div>
                </div>
              </div>
              <Link href="/arena/duels/cs2" className="px-5 py-2.5 rounded-2xl btn-accent text-black font-extrabold">
                Играть
              </Link>
            </div>
          </div>

          {/* Featured tournament */}
          <div className="mt-4">
            <TournamentHero t={featuredTournamentZava} />
          </div>

          {/* Main tiles */}
          <div className="mt-4 rounded-3xl border border-white/10 bg-black/30 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FaceTile
                title="Матчмейкинг"
                subtitle={loading ? "…" : `Открытых дуэлей: ${openDuels.length}`}
                href="/arena/duels/cs2"
                bgSrc="/arena/cards/open-duels.png"
              />
              <FaceTile
                title="Турниры"
                subtitle={loading ? "…" : `Сегодня: €${todayPool.toFixed(0)}`}
                href="/arena/tournaments"
                bgSrc="/arena/cards/tournadments.png"
              />
              <FaceTile
                title="Лига"
                subtitle={`${t("arena.beavrank")}: ${myRating} • ${ratingName}`}
                href="/arena/leaderboard"
                bgSrc="/arena/cards/beavrank.png"
              />
            </div>
          </div>

          {/* Matches */}
          <div className="mt-4 rounded-3xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-white font-extrabold text-lg">Матчи</div>
                <div className="text-white/60 text-sm mt-1">{t("arena.activeDuels.subtitle")}</div>
              </div>
              <Link href="/arena/duels/cs2" className="text-white/80 hover:text-white text-sm font-semibold">
                Открыть все <ArrowRight className="inline h-4 w-4 ml-1" />
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
                    className="rounded-2xl bg-white/5 border border-white/10 hover:bg-white/7 hover:border-white/15 px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-white font-semibold truncate">
                        {d.p1_nick || "Player"} <span className="text-white/35">vs</span> {d.p2_nick || "Waiting…"}
                      </div>
                      <div className="text-white/55 text-sm mt-1 truncate">CS2 • {d.map || "Map"} • {prettyTime(d.updated_at)}</div>
                    </div>
                    <div className="text-right shrink-0">
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

          {/* Tournaments (kept, but visually closer to FACEIT blocks) */}
          <div id="tournaments" className="mt-4 rounded-3xl border border-white/10 bg-black/30 p-4">
            <div className="text-white font-extrabold text-lg">Турниры</div>
            <div className="text-white/60 text-sm mt-1">Входной взнос формирует призовой фонд.</div>

            <div className="mt-4 grid gap-2">
              {loading ? (
                <div className="text-white/60">{t("common.loading")}</div>
              ) : visible.length === 0 ? (
                <div className="text-white/60">Нет турниров</div>
              ) : (
                visible.slice(0, 4).map((tt) => {
                  const pct = Math.round((tt.players / tt.maxPlayers) * 100);
                  const isOpen = tt.status === "open";
                  return (
                    <div key={tt.id} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-white font-semibold">
                            {tt.game} • {tt.title}
                          </div>
                          <div className="mt-1 text-white/60 text-sm">
                            Entry <span className="text-white/85 font-semibold">{tt.entryFee} {tt.currency}</span> •{" "}
                            {tt.players}/{tt.maxPlayers}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="hidden sm:block w-36 h-2 rounded-full bg-white/10 overflow-hidden border border-white/10">
                            <div className="h-full rounded-full bg-white/35" style={{ width: `${pct}%` }} />
                          </div>

                          {isOpen ? (
                            <button
                              onClick={() => join(tt.id)}
                              disabled={busy === tt.id}
                              className={cn(
                                "px-4 py-2 rounded-2xl font-extrabold text-black",
                                busy === tt.id ? "bg-white/40" : "btn-accent"
                              )}
                            >
                              {busy === tt.id ? "…" : "Join"}
                            </button>
                          ) : (
                            <div className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-white/80 text-xs font-bold">
                              {tt.status.toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </main>

        {/* Right sidebar */}
        <aside className="min-w-0">
          {/* Wallet / profile card */}
          <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/7 border border-white/10 grid place-items-center">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-white font-extrabold truncate">{t("arena.profile")}</div>
                <div className="text-white/60 text-sm">{t("arena.profile.subtitle")}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link href="/payments" className="rounded-2xl bg-white/5 border border-white/10 hover:bg-white/7 px-3 py-3">
                <div className="text-white font-extrabold">Wallet</div>
                <div className="text-white/60 text-sm mt-1">Deposit / Withdraw</div>
              </Link>
              <Link href="/arena/profile" className="rounded-2xl bg-white/5 border border-white/10 hover:bg-white/7 px-3 py-3">
                <div className="text-white font-extrabold">Profile</div>
                <div className="text-white/60 text-sm mt-1">Friends / Messages</div>
              </Link>
            </div>
          </div>

          {/* Activity */}
          <div className="mt-4 rounded-3xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/7 border border-white/10 grid place-items-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-white font-extrabold truncate">{t("arena.activity")}</div>
                <div className="text-white/60 text-sm">{t("arena.activity.subtitle")}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {loading ? (
                <div className="text-white/60">{t("common.loading")}</div>
              ) : activity.length === 0 ? (
                <div className="text-white/60">{t("arena.noActivity")}</div>
              ) : (
                activity.slice(0, 10).map((a) => (
                  <div key={a.id} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                    <div className="text-white/85 text-sm font-semibold">
                      {a.kind === "duel_done" ? (
                        <>
                          Победа: <span className="text-white font-extrabold">{a.winner_nick || "Player"}</span>
                        </>
                      ) : a.kind === "duel_active" ? (
                        <>Дуэль началась</>
                      ) : (
                        <>Новая дуэль</>
                      )}
                    </div>
                    <div className="text-white/60 text-sm mt-1">
                      {a.stake} {a.currency} • {prettyTime(a.at)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick links */}
          <div className="mt-4 rounded-3xl border border-white/10 bg-black/30 p-4">
            <div className="text-white font-extrabold">Quick</div>
            <div className="mt-3 grid gap-2">
              <Link href="/arena/duels/cs2" className="rounded-2xl bg-white/5 border border-white/10 hover:bg-white/7 px-4 py-3">
                Дуэли <ArrowRight className="inline h-4 w-4 ml-1" />
              </Link>
              <Link href="/arena/tournaments" className="rounded-2xl bg-white/5 border border-white/10 hover:bg-white/7 px-4 py-3">
                Турниры <ArrowRight className="inline h-4 w-4 ml-1" />
              </Link>
              <Link href="/arena/leaderboard" className="rounded-2xl bg-white/5 border border-white/10 hover:bg-white/7 px-4 py-3">
                Лига <ArrowRight className="inline h-4 w-4 ml-1" />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </ArenaShell>
  );
}

/** Tile (FACEIT-ish) */
function FaceTile({
  title,
  subtitle,
  href,
  bgSrc,
}: {
  title: string;
  subtitle: string;
  href: string;
  bgSrc: string;
}) {
  return (
    <Link
      href={href}
      className="relative rounded-3xl overflow-hidden border border-white/10 bg-black/35 hover:bg-black/45 transition"
    >
      <div className="absolute inset-0 opacity-55">
        <Image src={bgSrc} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 420px" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />
      <div className="relative p-4">
        <div className="text-white font-extrabold text-lg">{title}</div>
        <div className="text-white/60 text-sm mt-1">{subtitle}</div>
      </div>
    </Link>
  );
}