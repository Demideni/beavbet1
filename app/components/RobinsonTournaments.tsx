"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";

type TournamentCard = {
  key: string;
  title: string;
  subtitle: string;
  prize: string;
  href: string;
  bannerSrc: string;
};

const TOURNAMENTS: TournamentCard[] = [
  {
    key: "daily",
    title: "Ежедневный турнир",
    subtitle: "Robinson",
    prize: "$150 призовой фонд",
    href: "/tournaments",
    bannerSrc: "/images/tournaments/robinson-daily.png",
  },
  {
    key: "monthly",
    title: "Ежемесячный турнир",
    subtitle: "Robinson",
    prize: "$3000 призовой фонд",
    href: "/tournaments",
    bannerSrc: "/images/tournaments/robinson-monthly.png",
  },
];

export function RobinsonTournaments() {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pauseRef = useRef(false);
  const resumeTimerRef = useRef<number | null>(null);

  const scrollStep = useMemo(() => 420, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const getStep = () => {
      const card = el.querySelector<HTMLElement>("[data-tournament-card]");
      if (!card) return scrollStep;
      const styles = window.getComputedStyle(card);
      const mr = parseFloat(styles.marginRight || "0");
      return card.offsetWidth + mr;
    };

    const stopResumeTimer = () => {
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    };

    const pause = () => {
      pauseRef.current = true;
      stopResumeTimer();
    };

    const resumeSoon = () => {
      stopResumeTimer();
      resumeTimerRef.current = window.setTimeout(() => {
        pauseRef.current = false;
      }, 2200);
    };

    const onPointerDown = () => pause();
    const onPointerUp = () => resumeSoon();
    const onMouseEnter = () => pause();
    const onMouseLeave = () => resumeSoon();
    const onScroll = () => resumeSoon();

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("mouseenter", onMouseEnter);
    el.addEventListener("mouseleave", onMouseLeave);
    el.addEventListener("scroll", onScroll, { passive: true } as any);

    const tick = () => {
      if (pauseRef.current) return;
      const step = getStep();
      const maxScroll = el.scrollWidth - el.clientWidth;
      const next = Math.min(el.scrollLeft + step, maxScroll);
      el.scrollTo({ left: next >= maxScroll - 2 ? 0 : next, behavior: "smooth" });
    };

    const interval = window.setInterval(tick, 2600);

    return () => {
      window.clearInterval(interval);
      stopResumeTimer();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("mouseenter", onMouseEnter);
      el.removeEventListener("mouseleave", onMouseLeave);
      el.removeEventListener("scroll", onScroll as any);
    };
  }, [scrollStep]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-extrabold tracking-tight">
          <span className="text-accent">ТОП</span> Турниры
        </div>
        <Link href="/tournaments" className="text-sm text-white/70 hover:text-white transition">
          Смотреть все →
        </Link>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-5 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
      >
        {TOURNAMENTS.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            data-tournament-card
            className="relative min-w-[380px] h-52 md:h-60 rounded-3xl overflow-hidden border border-white/10 bg-white/5 snap-start group"
          >
            <div
              className="absolute inset-0 bg-center bg-cover transition-transform duration-700 will-change-transform group-hover:scale-[1.06]"
              style={{ backgroundImage: `url(${t.bannerSrc})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-bg/75 via-bg/35 to-transparent" />

            <div className="absolute inset-0 p-5 flex flex-col justify-between">
              <div>
                <div className="text-white/75 text-sm font-semibold">{t.subtitle}</div>
                <div className="mt-1 text-white text-2xl font-extrabold leading-tight">{t.title}</div>
                <div className="mt-2 text-white/80 font-semibold">{t.prize}</div>
              </div>
              <div className="inline-flex w-fit items-center justify-center px-5 py-2 rounded-2xl btn-accent font-semibold">
                Играть
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
