"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type LeaderRow = {
  rank: number;
  emailMasked: string;
  bestMultiplier: number;
  wins: number;
  rounds: number;
};

type TournamentDto = {
  id: string;
  type: "daily" | "monthly";
  title: string;
  prize_pool: number;
  currency: string;
  start_at: number;
  end_at: number;
  leaderboard: LeaderRow[];
  me: { bestMultiplier: number; wins: number; rounds: number } | null;
};

export default function Page() {
  const [tournaments, setTournaments] = useState<TournamentDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tournaments", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setTournaments(j.tournaments || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-3xl card-glass p-6 sm:p-8">
        <div className="text-3xl font-extrabold tracking-tight">
          Турниры <span className="text-accent">Robinson</span>
        </div>
        <div className="mt-2 text-white/65">
          Побеждает тот, кто приземлится на палубу и выбьет самый высокий <b>X</b>.
        </div>
        <div className="mt-4 flex gap-3 flex-wrap">
          <Link href="/casino/original/robinson" className="inline-flex px-6 py-3 rounded-2xl btn-accent font-semibold">
            Играть Robinson
          </Link>
        </div>
      </div>

      {loading && <div className="text-white/70">Загрузка…</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {tournaments.map((t) => (
          <div key={t.id} className="rounded-3xl card-glass p-5 border border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white/70 text-sm">{t.type === "daily" ? "Ежедневный" : "Ежемесячный"}</div>
                <div className="text-2xl font-extrabold mt-1">{t.title}</div>
                <div className="text-white/80 mt-2 font-semibold">
                  Призовой фонд: {t.prize_pool} {t.currency}
                </div>
              </div>
              {t.me && (
                <div className="text-right">
                  <div className="text-white/60 text-xs">Твой лучший X</div>
                  <div className="text-accent text-2xl font-extrabold">{t.me.bestMultiplier.toFixed(2)}x</div>
                  <div className="text-white/60 text-xs mt-1">
                    WIN: {t.me.wins} • Rounds: {t.me.rounds}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="text-white/70 text-sm font-semibold">Лидерборд</div>
              <div className="mt-2 overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-white/70">
                    <tr>
                      <th className="px-3 py-2 text-left w-12">#</th>
                      <th className="px-3 py-2 text-left">Игрок</th>
                      <th className="px-3 py-2 text-right">Best X</th>
                      <th className="px-3 py-2 text-right">WIN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(t.leaderboard || []).slice(0, 12).map((r) => (
                      <tr key={r.rank} className="border-t border-white/10">
                        <td className="px-3 py-2 text-white/80">{r.rank}</td>
                        <td className="px-3 py-2 text-white/85">{r.emailMasked}</td>
                        <td className="px-3 py-2 text-right text-white font-semibold">{r.bestMultiplier.toFixed(2)}x</td>
                        <td className="px-3 py-2 text-right text-white/80">{r.wins}</td>
                      </tr>
                    ))}
                    {(!t.leaderboard || t.leaderboard.length === 0) && (
                      <tr>
                        <td className="px-3 py-4 text-white/60" colSpan={4}>
                          Пока нет результатов — будь первым.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-white/55 text-xs">
                Учитывается только победная посадка на палубу. Лучший X в турнире.
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
