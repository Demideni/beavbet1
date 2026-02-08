import Link from "next/link";

type SportShortcut = {
  key: string;
  label: string;
  leagueKey: string;
  bannerSrc: string;
};

const TOP_SPORTS: SportShortcut[] = [
  {
    key: "soccer",
    label: "Футбол",
    leagueKey: "soccer_epl",
    bannerSrc: "/images/top-sports/soccer.png",
  },
  {
    key: "basketball",
    label: "Баскетбол",
    leagueKey: "basketball_nba",
    bannerSrc: "/images/top-sports/basketball.png",
  },
  {
    key: "tennis",
    label: "Теннис",
    leagueKey: "tennis_atp",
    bannerSrc: "/images/top-sports/tennis.png",
  },
];

export function TopSports() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold text-white/90">
          <span className="text-[#39ff6b]">TOP</span> Sports
        </div>
        <Link href="/sport" className="text-sm text-white/60 hover:text-white/90">
          Go to Sports
        </Link>
      </div>

      {/*
        Carousel (horizontal scroll / swipe):
        - add more sports by appending to TOP_SPORTS
        - banners must exist in /public/images/top-sports/
      */}
      <div className="-mx-4 px-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-3 snap-x snap-mandatory">
          {TOP_SPORTS.map((s) => (
            <Link
              key={s.key}
              href={`/sport?league=${encodeURIComponent(s.leagueKey)}`}
              className="relative h-24 w-44 sm:h-28 sm:w-56 flex-none snap-start overflow-hidden rounded-3xl border border-white/10 bg-white/5 hover:bg-white/8 transition"
            >
              {/* banner background */}
              <div
                className="absolute inset-0 bg-center bg-cover"
                style={{ backgroundImage: `url(${s.bannerSrc})` }}
              />

              {/* centered label */}
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-base font-semibold text-white tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
                  {s.label}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
