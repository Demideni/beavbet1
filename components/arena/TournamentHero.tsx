"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/components/utils/cn";

export type FeaturedTournament = {
  id: string;
  game: string; // "CS2"
  title: string; // "Турнир Завы"
  prizeText: string; // "15 000 ₽"
  startsAtISO: string; // ISO with +03:00
  bannerUrl: string; // "/arena/tournaments/zava-banner.png"
  maxPlayers: number; // 32
  playersRegistered: number; // 0
  ctaHref: string; // "/arena/tournaments"
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function msLeft(targetISO: string) {
  const t = new Date(targetISO).getTime();
  return t - Date.now();
}

function formatRuDateMsk(targetISO: string) {
  // Avoid user-local timezone confusion: display as Moscow time explicitly.
  try {
    const d = new Date(targetISO);
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return targetISO;
  }
}

function getBadge(ms: number) {
  if (ms <= 0) return { label: "LIVE", tone: "live" as const };
  const minutes = Math.floor(ms / 60000);
  if (minutes <= 30) return { label: "СТАРТ ЧЕРЕЗ 30 МИН", tone: "soon" as const };
  if (minutes <= 180) return { label: "СЕГОДНЯ", tone: "today" as const };
  return { label: "СКОРО", tone: "default" as const };
}

export function TournamentHero({ t }: { t: FeaturedTournament }) {
  const [left, setLeft] = useState(() => msLeft(t.startsAtISO));

  useEffect(() => {
    const id = setInterval(() => setLeft(msLeft(t.startsAtISO)), 1000);
    return () => clearInterval(id);
  }, [t.startsAtISO]);

  const badge = useMemo(() => getBadge(left), [left]);

  const { dd, hh, mm, ss } = useMemo(() => {
    const ms = Math.max(0, left);
    const total = Math.floor(ms / 1000);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return { dd: days, hh: hours, mm: mins, ss: secs };
  }, [left]);

  const progress = useMemo(() => {
    const max = Math.max(1, t.maxPlayers);
    const p = Math.min(1, Math.max(0, t.playersRegistered / max));
    return Math.round(p * 100);
  }, [t.playersRegistered, t.maxPlayers]);

  return (
    <section className="relative">
      {/* soft glow */}
      <div className="pointer-events-none absolute -inset-1 rounded-[28px] blur-2xl opacity-40 bg-[radial-gradient(circle_at_20%_30%,rgba(255,70,60,0.55),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(255,180,60,0.35),transparent_55%),radial-gradient(circle_at_50%_85%,rgba(255,70,60,0.25),transparent_55%)]" />

      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/35 backdrop-blur-xl">
        {/* Banner image */}
        <div
          className="relative h-[190px] md:h-[240px] bg-cover bg-center"
          style={{ backgroundImage: `url(${t.bannerUrl})` }}
        >
          {/* overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,90,70,0.25),transparent_60%)]" />

          {/* top row */}
          <div className="absolute left-5 right-5 top-5 flex items-center gap-3">
            <div
              className={cn(
                "px-3 py-1 rounded-full text-xs font-extrabold tracking-wide border backdrop-blur-md",
                badge.tone === "live" && "bg-red-500/20 border-red-400/30 text-red-200 animate-pulse",
                badge.tone === "soon" && "bg-orange-500/20 border-orange-300/25 text-orange-100",
                badge.tone === "today" && "bg-yellow-500/15 border-yellow-300/20 text-yellow-100",
                badge.tone === "default" && "bg-white/10 border-white/15 text-white/85"
              )}
            >
              {badge.label}
            </div>

            <div className="ml-auto flex items-center gap-2 text-xs text-white/70">
              <span className="px-2 py-1 rounded-full bg-white/8 border border-white/10">{t.game}</span>
              <span className="px-2 py-1 rounded-full bg-white/8 border border-white/10">
                Старт: {formatRuDateMsk(t.startsAtISO)} (МСК)
              </span>
            </div>
          </div>

          {/* content */}
          <div className="absolute left-6 bottom-6">
            <div className="text-white/80 text-sm font-semibold">ТУРНИР</div>
            <h2 className="text-white text-2xl md:text-3xl font-extrabold leading-tight">
              {t.title}
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="text-accent font-extrabold text-lg">{t.prizeText}</div>

              <div className="flex items-center gap-2 font-mono">
                <TimePill label="D" value={dd} />
                <TimePill label="H" value={pad2(hh)} />
                <TimePill label="M" value={pad2(mm)} />
                <TimePill label="S" value={pad2(ss)} pulse={badge.tone === "soon" || badge.tone === "live"} />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Link
                href={t.ctaHref}
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-2xl bg-accent text-black font-extrabold hover:opacity-90 transition shadow-[0_0_35px_rgba(255,90,70,0.25)]"
              >
                Участвовать
              </Link>

              <Link
                href="/arena/tournaments"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl bg-white/10 border border-white/12 text-white font-bold hover:bg-white/12 transition"
              >
                Все турниры
              </Link>
            </div>
          </div>
        </div>

        {/* footer info row */}
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-3 text-white/80">
            <div className="text-sm font-semibold">
              Участники: <span className="text-white font-extrabold">{t.playersRegistered}</span>
              <span className="text-white/60">/{t.maxPlayers}</span>
            </div>

            <div className="text-sm text-white/60">
              Регистрация открыта
            </div>
          </div>

          <div className="md:ml-auto w-full md:w-[340px]">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[rgba(255,70,60,0.9)] to-[rgba(255,180,60,0.7)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-white/55">Заполнено: {progress}%</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TimePill({
  label,
  value,
  pulse,
}: {
  label: string;
  value: string | number;
  pulse?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-[56px] px-3 py-2 rounded-2xl bg-black/55 border border-white/12 text-white",
        pulse && "animate-pulse"
      )}
    >
      <div className="text-[10px] leading-none text-white/60 font-extrabold">{label}</div>
      <div className="text-base leading-none font-extrabold">{value}</div>
    </div>
  );
}