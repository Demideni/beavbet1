"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

type LeagueBlock = {
  sportKey: string;
  title: string;
  events: Array<{
    id: string;
    commenceTime: string;
    homeTeam: string;
    awayTeam: string;
    odds: { home?: number; away?: number; draw?: number; bookmaker?: string };
  }>;
};

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function HomeOddsStrip() {
  const { t } = useI18n();
  const [data, setData] = useState<LeagueBlock[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/odds/top", { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || t("odds.failedToLoad"));
        return j.data as LeagueBlock[];
      })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e?.message || t("odds.failedToLoad")));
    return () => {
      alive = false;
    };
  }, []);

  const blocks = useMemo(() => data || [], [data]);

  if (err) return null; // чтобы не шуметь на главной
  if (!data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-white/60">{t("odds.loading")}</div>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/90">{t("odds.topTitle")}</div>
        <a href="/sport" className="text-xs text-white/60 hover:text-white/90">
          {t("odds.openSport")} →
        </a>
      </div>

      {/* mobile: horizontal scroll | desktop: grid */}
      <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
        {blocks.map((b) => (
          <div
            key={b.sportKey}
            className="min-w-[280px] md:min-w-0 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">{b.title}</div>
              <a href={`/sport?league=${encodeURIComponent(b.sportKey)}`} className="text-xs text-white/60 hover:text-white/90">
                {t("common.view")}
              </a>
            </div>

            <div className="mt-3 flex flex-col gap-3">
              {b.events.length === 0 ? (
                <div className="text-xs text-white/50">{t("odds.noEvents")}</div>
              ) : (
                b.events.map((e) => (
                  <div key={e.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[11px] text-white/50">{fmtTime(e.commenceTime)}</div>
                    <div className="mt-1 text-sm text-white/90">
                      {e.homeTeam} <span className="text-white/40">vs</span> {e.awayTeam}
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-white/5 px-2 py-1 text-center text-xs text-white/80">
                        1<br />
                        <span className="font-semibold">{e.odds.home ?? "—"}</span>
                      </div>
                      <div className="rounded-lg bg-white/5 px-2 py-1 text-center text-xs text-white/80">
                        X<br />
                        <span className="font-semibold">{e.odds.draw ?? "—"}</span>
                      </div>
                      <div className="rounded-lg bg-white/5 px-2 py-1 text-center text-xs text-white/80">
                        2<br />
                        <span className="font-semibold">{e.odds.away ?? "—"}</span>
                      </div>
                    </div>

                    {e.odds.bookmaker && <div className="mt-2 text-[11px] text-white/40">{t("odds.book")}: {e.odds.bookmaker}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
