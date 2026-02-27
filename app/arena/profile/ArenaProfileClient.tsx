"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ArenaShell from "../ArenaShell";
import { BadgeCheck, ChevronLeft, Flame, Swords, Trophy } from "lucide-react";
import ArenaFriendsPanel from "@/components/arena/ArenaFriendsPanel";
import ArenaMessagesPanel from "@/components/arena/ArenaMessagesPanel";
import ImageUploadInline from "@/components/arena/ImageUploadInline";
import { cn } from "@/components/utils/cn";

type Profile = {
  userId: string;
  nickname: string | null;
  elo: number;
  division: string;
  matches: number;
  wins: number;
  losses: number;
  winrate: number;
};

type HistoryRow = {
  id: string;
  game: string;
  stake: number;
  currency: string;
  status: string;
  map?: string | null;
  updated_at: number;
  ended_at?: number | null;
  p1_nick?: string | null;
  p2_nick?: string | null;
  winner_nick?: string | null;
  winner_user_id?: string | null;
};

export default function ArenaProfileClient() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [nickInput, setNickInput] = useState("");
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const search = useSearchParams();
  const [tab, setTab] = useState<"history" | "friends" | "messages">("history");

  async function saveProfile() {
    setSaving(true);
    const r = await fetch("/api/arena/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: nickInput, avatarUrl: avatarUrlInput }),
    });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) return alert(j?.error || "Error");
    load();
  }

  async function load() {
    setLoading(true);
    const r = await fetch("/api/arena/profile", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setProfile(j?.profile ?? null);
    setNickInput(j?.profile?.nickname ?? "");
    setAvatarUrlInput(j?.profile?.avatarUrl ?? "");
    setHistory(j?.history ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const q = String(search.get("tab") || "").toLowerCase();
    if (q === "friends" || q === "messages" || q === "history") setTab(q as any);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = useMemo(() => {
    if (!profile) return "Profile";
    return `${profile.nickname || "Player"} • ${profile.division}`;
  }, [profile]);

  function prettyDate(ts: number) {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <ArenaShell>
      <div className="relative">
        <div className="relative z-10 mx-auto max-w-[1100px] px-4 py-10">
          <div className="flex items-center justify-between gap-3">
            <Link href="/arena" className="inline-flex items-center gap-2 text-white/80 hover:text-white">
              <ChevronLeft className="h-4 w-4" /> Back to Arena
            </Link>
            <Link href="/arena/leaderboard" className="text-white/80 hover:text-white">
              Leaderboard →
            </Link>
          </div>

          <div className="mt-6 rounded-3xl card-glass p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="text-white text-2xl md:text-3xl font-extrabold">{title}</div>
                <div className="text-white/60 mt-1">HLTV-style stats • BeavRank</div>
              </div>

              {profile ? (
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/6 border border-white/10 px-4 py-3">
                    <div className="text-white/60 text-xs">
                      <span className="inline-flex items-center gap-2">
                        <Image src="/brand/beavrank.png" alt="BeavRank" width={14} height={14} className="opacity-90" />
                        BeavRank
                      </span>
                    </div>
                    <div className="text-white font-extrabold text-xl mt-1">{profile.elo}</div>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center">
                    <Flame className="h-5 w-5 text-white" />
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-3xl bg-black/20 border border-white/10 p-4">
                  <div className="text-white/60 text-xs">Nickname</div>
                  <input
                    value={nickInput}
                    onChange={(e) => setNickInput(e.target.value)}
                    className="mt-2 w-full h-11 rounded-2xl bg-black/30 border border-white/10 px-3 text-white outline-none"
                    placeholder="Your nick"
                  />
                </div>
                <div className="rounded-3xl bg-black/20 border border-white/10 p-4 md:col-span-2">
                  <ImageUploadInline
                    label="Avatar"
                    value={avatarUrlInput}
                    onChange={setAvatarUrlInput}
                    help="Загрузится и сохранится на сервере (Render persistent disk)."
                    showUrl
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className={cn(
                    "h-11 px-4 rounded-2xl bg-accent text-black font-extrabold",
                    saving ? "opacity-70" : "hover:brightness-110"
                  )}
                >
                  {saving ? "Saving…" : "Save profile"}
                </button>
                <div className="text-white/45 text-xs">Аватар теперь загружается через Upload.</div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={<Trophy className="h-4 w-4" />} label="Winrate" value={profile ? `${profile.winrate}%` : "—"} />
              <StatCard icon={<BadgeCheck className="h-4 w-4" />} label="Wins" value={profile ? String(profile.wins) : "—"} />
              <StatCard icon={<Swords className="h-4 w-4" />} label="Losses" value={profile ? String(profile.losses) : "—"} />
              <StatCard icon={<Flame className="h-4 w-4" />} label="Matches" value={profile ? String(profile.matches) : "—"} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTab("history")}
              className={
                tab === "history"
                  ? "h-11 px-4 rounded-2xl bg-accent text-black font-bold"
                  : "h-11 px-4 rounded-2xl bg-white/6 border border-white/10 text-white/85 hover:bg-white/10"
              }
            >
              Match history
            </button>
            <button
              onClick={() => setTab("friends")}
              className={
                tab === "friends"
                  ? "h-11 px-4 rounded-2xl bg-accent text-black font-bold"
                  : "h-11 px-4 rounded-2xl bg-white/6 border border-white/10 text-white/85 hover:bg-white/10"
              }
            >
              Friends
            </button>
            <button
              onClick={() => setTab("messages")}
              className={
                tab === "messages"
                  ? "h-11 px-4 rounded-2xl bg-accent text-black font-bold"
                  : "h-11 px-4 rounded-2xl bg-white/6 border border-white/10 text-white/85 hover:bg-white/10"
              }
            >
              Messages
            </button>
          </div>

          {tab === "friends" ? (
            <div className="mt-4">
              <ArenaFriendsPanel />
            </div>
          ) : null}

          {tab === "messages" ? (
            <div className="mt-4">
              <ArenaMessagesPanel />
            </div>
          ) : null}

          {tab === "history" ? (
            <div className="mt-4 rounded-3xl card-glass p-6">
              <div className="text-white text-xl font-extrabold">Match history</div>
              <div className="text-white/60 text-sm mt-1">Последние матчи в Arena.</div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[760px] w-full text-sm">
                  <thead>
                    <tr className="text-white/60">
                      <th className="text-left font-semibold py-2">Date</th>
                      <th className="text-left font-semibold py-2">Game</th>
                      <th className="text-left font-semibold py-2">Match</th>
                      
                      <th className="text-left font-semibold py-2">Result</th>
                      <th className="text-left font-semibold py-2">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td className="py-4 text-white/60" colSpan={5}>
                          Loading…
                        </td>
                      </tr>
                    ) : history.length === 0 ? (
                      <tr>
                        <td className="py-4 text-white/60" colSpan={5}>
                          No matches yet.
                        </td>
                      </tr>
                    ) : (
                      history.map((h) => (
                        <tr key={h.id} className="border-t border-white/10">
                          <td className="py-3 text-white/70">{prettyDate(Number(h.ended_at || h.updated_at))}</td>
                          <td className="py-3 text-white">{String(h.game || "").toUpperCase()}</td>
                          <td className="py-3 text-white/85">
                            {h.p1_nick || "P1"} <span className="text-white/35">vs</span> {h.p2_nick || "P2"}
                          </td>
                          
                          <td className="py-3">
                            <span className="inline-flex items-center rounded-full border border-white/12 bg-white/6 px-3 py-1 text-white/85">
                              {String(h.status).toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3">
                            <Link
                              className="text-accent hover:opacity-90"
                              href={h.game === "cs2" ? `/arena/duels/cs2/${h.id}` : `/arena/match/${h.id}`}
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </ArenaShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/6 border border-white/10 p-4">
      <div className="flex items-center justify-between">
        <div className="text-white/60 text-xs">{label}</div>
        <div className="text-white/85">{icon}</div>
      </div>
      <div className="mt-2 text-white text-xl font-extrabold">{value}</div>
    </div>
  );
}