"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

type LeagueShortcut = {
  key: string;
  label: string;
  leagueKey: string;
  bannerSrc: string;
};

// Add more leagues by appending to this list.
// Banners should live in: /public/images/top-leagues/
const TOP_LEAGUES: LeagueShortcut[] = [
  {
    key: "la-liga",
    label: "LA LIGA",
    leagueKey: "soccer_spain_la_liga",
    bannerSrc: "/images/top-leagues/la-liga.png",
  },
  {
    key: "epl",
    label: "ENGLISH PREMIER LEAGUE",
    leagueKey: "soccer_epl",
    bannerSrc: "/images/top-leagues/english-premier-league.png",
  },
];

export function TopLeagues() {
  const { t } = useI18n();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pauseRef = useRef(false);
  const resumeTimerRef = useRef<number | null>(null);

  const scrollStep = useMemo(() => {
    // Fallback; we will recalc from DOM after mount.
    return 360;
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const getStep = () => {
      const card = el.querySelector<HTMLElement>("[data-league-card]");
      if (!card) return scrollStep;
      const styles = window.getComputedStyle(card.parentElement ?? card);
      const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
      return Math.round(card.getBoundingClientRect().width + gap);
    };

    let step = getStep();
    const ro = new ResizeObserver(() => {
      step = getStep();
    });
    ro.observe(el);

    const pause = () => {
      pauseRef.current = true;
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    };
    const resumeSoon = () => {
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = window.setTimeout(() => {
        pauseRef.current = false;
      }, 1200);
    };

    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resumeSoon);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", resumeSoon);
    el.addEventListener("pointerdown", pause);
    el.addEventListener("pointerup", resumeSoon);
    el.addEventListener("scroll", resumeSoon, { passive: true });

    const id = window.setInterval(() => {
      if (!scrollerRef.current) return;
      if (pauseRef.current) return;

      const s = scrollerRef.current;
      const atEnd = s.scrollLeft + s.clientWidth >= s.scrollWidth - 8;
      if (atEnd) {
        s.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }
      s.scrollBy({ left: step, behavior: "smooth" });
    }, 2600);

    return () => {
      window.clearInterval(id);
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
      ro.disconnect();
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resumeSoon);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", resumeSoon);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("pointerup", resumeSoon);
      el.removeEventListener("scroll", resumeSoon);
    };
  }, [scrollStep]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold text-white/90">
          <span className="text-[#39ff6b]">TOP</span> {t("leagues.title")}
        </div>
        <Link href="/sport" className="text-sm text-white/60 hover:text-white/90">
          {t("sports.goTo")}
        </Link>
      </div>

      <div
        ref={scrollerRef}
        className="-mx-4 px-4 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex gap-5 snap-x snap-mandatory">
          {TOP_LEAGUES.map((l) => (
            <Link
              key={l.key}
              href={`/sport?league=${encodeURIComponent(l.leagueKey)}`}
              className="flex-none snap-start"
            >
              <div data-league-card className="w-[336px] sm:w-[432px]">
                <div className="group relative h-[144px] sm:h-[168px] rounded-3xl overflow-hidden border border-white/10">
                  {/* Parallax / hover */}
                  <img
                    src={l.bannerSrc}
                    alt={l.label}
                    className="absolute inset-0 h-full w-full object-cover transform transition duration-500 ease-out group-hover:scale-110 group-hover:-translate-y-1"
                    draggable={false}
                  />
                </div>
                <div className="mt-3 text-base sm:text-lg font-bold tracking-wide text-white/90 text-center">
                  {l.label}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
