"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

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
      {/* Background image (mobile/desktop) */}
      <div className="absolute inset-0">
        {/* Desktop */}
        <Image
          src={desktopArt}
          alt={title}
          fill
          priority={false}
          className="hidden md:block object-cover"
          sizes="(min-width: 768px) 50vw, 0px"
        />
        {/* Mobile */}
        <Image
          src={mobileBg ?? desktopArt}
          alt={title}
          fill
          priority={false}
          className="md:hidden object-cover"
          sizes="(max-width: 768px) 100vw, 0px"
        />
      </div>

      {/* Subtle dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/25" />

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

      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/0 to-white/5" />
    </Link>
  );
}

export function PromoTiles() {
  const { t } = useI18n();

  return (
    <section
      className={
        "flex gap-4 lg:gap-5 overflow-x-auto md:overflow-visible pb-2 md:pb-0 snap-x snap-mandatory " +
        "md:grid md:grid-cols-2 lg:grid-cols-2"
      }
    >
      <Tile
        title={t("nav.casino")}
        desc=""
        href="/casino"
        desktopArt="/images/tiles/casino-tile-desktop.png"
        mobileBg="/images/tiles/casino-tile-mobile.png"
      />
      <Tile
        title={t("nav.arena")}
        desc=""
        href="/arena"
        desktopArt="/images/tiles/arena-tile-desktop.png"
        mobileBg="/images/tiles/arena-tile-mobile.png"
      />
      <Tile
        title={t("nav.sport")}
        desc=""
        href="/sport"
        desktopArt="/images/tiles/sport-tile-desktop.png"
        mobileBg="/images/tiles/sport-tile-mobile.png"
      />
    </section>
  );
}
