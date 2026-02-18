import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

function Tile({
  title,
  desc,
  href,
  desktopArt,
  mobileBg,
}: {
  title: string;
  desc: string;
  href: string;
  desktopArt: string;
  mobileBg?: string;
}) {
  return (
    <Link
      href={href}
      className="group tile-hover relative overflow-hidden rounded-3xl card-glass p-5 lg:p-7 min-h-[150px] transition min-w-[260px] md:min-w-0 snap-start"
    >
      {/* Desktop full-width banner background */}
      {desktopArt ? (
        <div className="absolute inset-0 hidden md:block">
          <Image
            src={desktopArt}
            alt={title}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 50vw, (min-width: 768px) 50vw, 100vw"
          />
          {/* Slight dark overlay for readability */}
          <div className="absolute inset-0 bg-black/25" />
        </div>
      ) : null}

      {/* Mobile-only banner background */}
      {mobileBg ? (
        <div
          className="absolute inset-0 bg-cover bg-center md:hidden"
          style={{ backgroundImage: `url(${mobileBg})` }}
        />
      ) : null}

      {/* Subtle dark overlay for text readability on mobile */}
      {mobileBg ? <div className="absolute inset-0 bg-black/25 md:hidden" /> : null}

      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-extrabold">{title}</div>
          <ChevronRight className="size-5 text-white/55 group-hover:text-white/80 transition" />
        </div>
        {/* Keep description on desktop only (mobile: hide) */}
        {desc ? (
          <div className="mt-2 text-white/60 max-w-[420px] hidden md:block">
            {desc}
          </div>
        ) : null}
      </div>

      {/* Text legibility gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-black/15 to-black/0" />
    </Link>
  );
}

export function PromoTiles() {
  return (
    <section
      className={
        "flex gap-4 lg:gap-5 overflow-x-auto md:overflow-visible pb-2 md:pb-0 snap-x snap-mandatory " +
        "md:grid md:grid-cols-2 lg:grid-cols-2"
      }
    >
      <Tile
        title="Казино"
        desc=""
        href="/casino"
        desktopArt="/images/tiles/casino-tile-desktop.png"
        mobileBg="/images/tiles/casino-tile-mobile.png"
      />
      <Tile
        title="Arena"
        desc=""
        href="/arena"
        desktopArt="/images/tiles/arena-tile-desktop.png"
        mobileBg="/images/tiles/arena-tile-mobile.png"
      />
      <Tile
        title="Спорт"
        desc=""
        href="/sport"
        desktopArt="/images/tiles/sport-tile-desktop.png"
        mobileBg="/images/tiles/sport-tile-mobile.png"
      />
    </section>
  );
}
