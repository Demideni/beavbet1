"use client";

import { cn } from "@/components/utils/cn";
import ArenaSidebar from "@/components/arena/ArenaSidebar";
import ArenaRightRail from "@/components/arena/ArenaRightRail";
import Link from "next/link";
import { useEffect, useState } from "react";

type ThreadPreview = {
  threadId: string;
  lastMessageAt: number;
  lastMessageText: string;
  otherNick?: string;
  unread?: number;
};

function Tile({
  title,
  subtitle,
  href,
  img,
}: {
  title: string;
  subtitle: string;
  href: string;
  img: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative overflow-hidden rounded-3xl",
        "border border-white/10 bg-white/4",
        "p-4 md:p-5",
        "hover:bg-white/6 transition"
      )}
    >
      <div className="flex items-start gap-4">
        <img
          src={img}
          alt=""
          className="size-14 rounded-2xl border border-white/10 bg-black/30 object-cover"
          onError={(e) => ((e.currentTarget.style.display = "none"), null)}
        />
        <div className="min-w-0">
          <div className="text-sm md:text-base font-extrabold tracking-tight text-white">{title}</div>
          <div className="text-xs text-white/65 mt-0.5">{subtitle}</div>
        </div>
      </div>

      <div className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-white/80 group-hover:text-white">
        Open <span className="opacity-60">→</span>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/5">
        <div className="h-full w-[28%] bg-accent/80" />
      </div>
    </Link>
  );
}

export default function ArenaHome() {
  const [unreadDm, setUnreadDm] = useState(0);
  const [friendReq, setFriendReq] = useState(0);
  const [threads, setThreads] = useState<ThreadPreview[]>([]);

  // Lightweight: pull threads to show small inbox snippet + keep badge updated.
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const r = await fetch("/api/arena/dm/threads", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!alive) return;
        const arr: ThreadPreview[] = Array.isArray(j?.threads) ? j.threads : [];
        setThreads(arr.slice(0, 3));
        const unread = arr.reduce((s, t) => s + (t.unread || 0), 0);
        setUnreadDm(unread);
      } catch {}
      try {
        const r2 = await fetch("/api/arena/friends/incoming/count", { cache: "no-store" });
        if (r2.ok) {
          const j2 = await r2.json();
          if (alive) setFriendReq(Number(j2?.count || 0));
        }
      } catch {}
    };

    load();
    const id = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="min-h-screen">
      <ArenaSidebar unreadDm={unreadDm} friendReq={friendReq} />

      <div className="md:pl-[280px]">
        <div className="mx-auto max-w-[1240px] px-4 lg:px-6">
          <div className="pt-6 md:pt-8 pb-24 md:pb-8">
            {/* HERO */}
            <div
              className={cn(
                "relative overflow-hidden rounded-[28px]",
                "border border-white/10 bg-white/4",
                "p-5 md:p-7"
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold tracking-[0.14em] text-white/55">
                    BEAVBET ARENA
                  </div>
                  <div className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                    Play. Win. Rank up.
                  </div>
                  <div className="mt-2 text-sm text-white/70 max-w-[620px]">
                    FACEIT-like experience with our red vibe — fast matchmaking, cups every 30 minutes, clans and rewards.
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href="/arena/matches"
                      className="inline-flex items-center justify-center h-11 px-5 rounded-2xl btn-accent font-extrabold"
                    >
                      Start matchmaking
                    </Link>
                    <Link
                      href="/arena/connect"
                      className="inline-flex items-center justify-center h-11 px-5 rounded-2xl bg-white/8 border border-white/10 text-white font-bold hover:bg-white/10"
                    >
                      Connect game
                    </Link>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="rounded-3xl border border-white/10 bg-black/25 px-4 py-3">
                    <div className="text-[11px] text-white/60">Online</div>
                    <div className="text-sm font-extrabold text-white mt-0.5">1,248</div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/25 px-4 py-3">
                    <div className="text-[11px] text-white/60">Queued</div>
                    <div className="text-sm font-extrabold text-white mt-0.5">162</div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/25 px-4 py-3">
                    <div className="text-[11px] text-white/60">Cups</div>
                    <div className="text-sm font-extrabold text-white mt-0.5">Live</div>
                  </div>
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/5">
                <div className="h-full w-[22%] bg-accent/80" />
              </div>
            </div>

            {/* TILES */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <Tile
                title="Matchmaking"
                subtitle="Find opponents instantly"
                href="/arena/matches"
                img="/arena/ui/matchmaking.png"
              />
              <Tile
                title="Tournaments"
                subtitle="Blitz cups & brackets"
                href="/arena/tournaments"
                img="/arena/ui/tournaments.png"
              />
              <Tile
                title="League"
                subtitle="Climb BeavRank"
                href="/arena/leaderboard"
                img="/arena/ui/league.png"
              />
            </div>

            {/* SECTIONS */}
            <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/4 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-extrabold tracking-tight text-white">Your inbox</div>
                    <Link href="/arena/profile?tab=messages" className="text-xs text-white/60 hover:text-white">
                      Open Messages
                    </Link>
                  </div>

                  <div className="mt-3 space-y-2">
                    {threads.length === 0 ? (
                      <div className="text-sm text-white/60">
                        No dialogs yet. Click a nickname in Arena chat to start a DM.
                      </div>
                    ) : (
                      threads.map((t) => (
                        <Link
                          key={t.threadId}
                          href={`/arena/profile?tab=messages&thread=${encodeURIComponent(t.threadId)}`}
                          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 hover:bg-black/35"
                        >
                          <div className="size-10 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center font-extrabold">
                            {(t.otherNick || "U").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{t.otherNick || "Dialog"}</div>
                            <div className="text-[11px] text-white/60 truncate">{t.lastMessageText || "…"}</div>
                          </div>
                          {t.unread && t.unread > 0 ? (
                            <div className="ml-auto min-w-6 h-6 px-2 rounded-full bg-accent text-black text-[11px] font-extrabold flex items-center justify-center">
                              {t.unread > 99 ? "99+" : t.unread}
                            </div>
                          ) : null}
                        </Link>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/4 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-extrabold tracking-tight text-white">Live matches</div>
                    <Link href="/arena/matches" className="text-xs text-white/60 hover:text-white">
                      View all
                    </Link>
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold text-white">CS2 • 1v1</div>
                          <div className="text-[11px] text-white/60">LIVE</div>
                        </div>
                        <div className="mt-2 text-[11px] text-white/60">Arena • Frankfurt</div>
                        <div className="mt-2 flex justify-between text-xs text-white/80">
                          <span>Player A</span>
                          <span className="text-white/50">vs</span>
                          <span>Player B</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <ArenaRightRail />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}