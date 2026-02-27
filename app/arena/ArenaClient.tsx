"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Crosshair, ArrowRight } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/components/utils/cn";
import ArenaShell from "./ArenaShell";
import { TournamentHero } from "@/components/arena/TournamentHero";
import { featuredTournamentZava } from "@/components/arena/FeaturedTournamentData";
import ArenaNewsPanel from "@/components/arena/ArenaNewsPanel";
import DailyRewardSpin from "@/components/arena/DailyRewardSpin";
import MobileTilesCarousel from "@/components/arena/MobileTilesCarousel";

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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
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

          {/* Main tiles */}
<div className="mt-4">
  {/* Mobile: carousel */}
  <MobileTilesCarousel
    tiles={[
      {
        key: "mm",
        title: "Матчмейкинг",
        subtitle: loading ? "…" : `Открытых дуэлей: ${openDuels.length}`,
        href: "/arena/duels/cs2",
        bgSrc: "/arena/cards/open-duels.png",
      },
      {
        key: "tours",
        title: "Турниры",
        subtitle: loading ? "…" : `Сегодня: €${todayPool.toFixed(0)}`,
        href: "#tournaments",
        bgSrc: "/arena/cards/tournadments.png",
      },
      {
        key: "league",
        title: "Лига",
        subtitle: `${t("arena.beavrank")}: ${myRating} • ${ratingName}`,
        href: "/arena/leaderboard",
        bgSrc: "/arena/cards/beavrank.png",
      },
    ]}
  />

  {/* Desktop/tablet: grid */}
  <div className="hidden md:grid grid-cols-3 gap-3">
    <FaceTile
      title="Матчмейкинг"
      subtitle={loading ? "…" : `Открытых дуэлей: ${openDuels.length}`}
      href="/arena/duels/cs2"
      bgSrc="/arena/cards/open-duels.png"
    />
    <FaceTile
      title="Турниры"
      subtitle={loading ? "…" : `Сегодня: €${todayPool.toFixed(0)}`}
      href="#tournaments"
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
                      <div className="text-white/55 text-sm mt-1 truncate">
                        CS2 • {d.map || "Map"} • {prettyTime(d.updated_at)}
                      </div>
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

          {/* Tournaments */}
          <div id="tournaments" className="mt-4 rounded-3xl border border-white/10 bg-black/30 p-4">
            <div className="text-white font-extrabold text-lg">Турниры</div>
            <div className="text-white/60 text-sm mt-1">Входной взнос формирует призовой фонд.</div>

            {/* Featured tournament */}
            <div className="mt-4">
              <TournamentHero t={featuredTournamentZava} />
            </div>

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

        {/* Right sidebar: Новости арены (admin posts) */}
        <aside className="min-w-0">
          <ArenaNewsPanel />
        </aside>
      </div>
    </ArenaShell>
  );
}

/** Tile (FACEIT-ish) + glow like featured tournament */
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
  const isHash = href.startsWith("#");

  const outerCls = "group relative block rounded-3xl overflow-hidden";
  const innerCls =
    "relative rounded-3xl bg-black/25 border border-white/10 hover:border-white/15 overflow-hidden transition";

  const content = (
    <>
      {/* Glow layer */}
      <div
        className="pointer-events-none absolute -inset-1 rounded-[28px] opacity-0 group-hover:opacity-100 transition duration-500 blur-2xl
        bg-[radial-gradient(circle_at_20%_30%,rgba(255,70,60,0.55),transparent_55%),
             radial-gradient(circle_at_80%_20%,rgba(255,180,60,0.35),transparent_55%),
             radial-gradient(circle_at_50%_85%,rgba(255,70,60,0.25),transparent_55%)]"
      />

      <div className={innerCls}>
        <div className="h-[130px] relative">
          <Image
            src={bgSrc}
            alt=""
            fill
            className="object-cover opacity-90 group-hover:opacity-100 transition"
            sizes="(max-width: 1024px) 100vw, 420px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition">
            <div className="absolute -left-1/3 top-0 h-full w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-accent/90 h-1" />
        </div>

        <div className="p-4">
          <div className="text-white font-extrabold">{title}</div>
          <div className="text-white/60 text-sm mt-1">{subtitle}</div>
        </div>
      </div>
    </>
  );

  if (isHash) {
    return (
      <a href={href} className={outerCls}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={outerCls}>
      {content}
    </Link>
  );
}