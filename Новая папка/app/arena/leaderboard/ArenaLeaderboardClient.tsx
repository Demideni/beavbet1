"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ArenaShell from "../ArenaShell";
import { ChevronLeft, Crown, Flame } from "lucide-react";

type Row = {
  user_id: string;
  nickname: string | null;
  elo: number;
  division: string;
  matches: number;
  wins: number;
  losses: number;
  winrate: number;
};

export default function ArenaLeaderboardClient() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/arena/leaderboard", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setRows(j?.rows ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <ArenaShell>
      <div className="relative">
        <div className="relative z-10 mx-auto max-w-[1100px] px-4 py-10">
          <div className="flex items-center justify-between gap-3">
            <Link href="/arena" className="inline-flex items-center gap-2 text-white/80 hover:text-white">
              <ChevronLeft className="h-4 w-4" /> Back to Arena
            </Link>
            <Link href="/arena/profile" className="text-white/80 hover:text-white">
              My profile →
            </Link>
          </div>

          <div className="mt-6 rounded-3xl card-glass p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="text-white text-2xl md:text-3xl font-extrabold">Leaderboard</div>
                <div className="text-white/60 mt-1">Top players by BeavRank.</div>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center">
                <Crown className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-3xl card-glass p-6 overflow-x-auto">
            <table className="min-w-[820px] w-full text-sm">
              <thead>
                <tr className="text-white/60">
                  <th className="text-left font-semibold py-2">#</th>
                  <th className="text-left font-semibold py-2">Player</th>
                  <th className="text-left font-semibold py-2">Division</th>
                  <th className="text-left font-semibold py-2">
                    <span className="inline-flex items-center gap-2">
                      <Image src="/brand/beavrank.png" alt="BeavRank" width={14} height={14} className="opacity-90" />
                      BeavRank
                    </span>
                  </th>
                  <th className="text-left font-semibold py-2">Matches</th>
                  <th className="text-left font-semibold py-2">Winrate</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="py-4 text-white/60" colSpan={6}>
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="py-4 text-white/60" colSpan={6}>
                      No data.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, idx) => (
                    <tr key={r.user_id} className="border-t border-white/10">
                      <td className="py-3 text-white/70">{idx + 1}</td>
                      <td className="py-3 text-white font-semibold">
                        {r.nickname || "Player"}
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-white/85">
                          <Flame className="h-3.5 w-3.5" /> {r.division}
                        </span>
                      </td>
                      <td className="py-3 text-white font-extrabold">{r.elo}</td>
                      <td className="py-3 text-white/85">{r.matches}</td>
                      <td className="py-3 text-white/85">{r.winrate}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ArenaShell>
  );
}
