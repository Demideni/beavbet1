"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/components/utils/cn";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Home, Video, Newspaper, MessageCircle, User } from "lucide-react";

const lobbyItems: Array<{
  href: string;
  labelKey: string;
  pngIcon?: string;
}> = [
  { href: "/", labelKey: "nav.home", pngIcon: "/icons/nav/nav-home.png" },
  { href: "/casino", labelKey: "nav.casino", pngIcon: "/icons/nav/nav-casino.png" },
  { href: "/arena", labelKey: "nav.arena", pngIcon: "/icons/nav/nav-arena.png" },
  { href: "/sport", labelKey: "nav.sport", pngIcon: "/icons/nav/nav-sport.png" },
  { href: "/tournaments", labelKey: "nav.tournaments", pngIcon: "/icons/nav/nav-tournaments.png" },
];

const arenaItems: Array<{
  href: string;
  label: string;
  icon: React.ReactNode;
  // allow custom active matching (messages has query)
  isActive?: (pathname: string) => boolean;
}> = [
  {
    href: "/arena",
    label: "Главная",
    icon: <Home className="h-[22px] w-[22px]" />,
    isActive: (p) => p === "/arena",
  },
  {
    href: "/arena/partners",
    label: "Стримы",
    icon: <Video className="h-[22px] w-[22px]" />,
    isActive: (p) => p.startsWith("/arena/partners"),
  },
  {
    href: "/arena/feed",
    label: "Лента",
    icon: <Newspaper className="h-[22px] w-[22px]" />,
    isActive: (p) => p.startsWith("/arena/feed"),
  },
  {
    href: "/arena/profile?tab=messages",
    label: "Сообщения",
    icon: <MessageCircle className="h-[22px] w-[22px]" />,
    // активируем и на /arena/profile (любая вкладка), чтобы подсвечивалось
    isActive: (p) => p.startsWith("/arena/profile"),
  },
  {
    href: "/arena/room",
    label: "Моя комната",
    icon: <User className="h-[22px] w-[22px]" />,
    isActive: (p) => p.startsWith("/arena/room"),
  },
];

export function MobileNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [bouncingHref, setBouncingHref] = useState<string | null>(null);

  // ✅ 1) Убираем таббар на главной видео-странице
  if (pathname === "/") return null;

  const isArena = pathname?.startsWith("/arena");

  const triggerBounce = (href: string) => {
    setBouncingHref(href);
    window.setTimeout(() => {
      setBouncingHref((cur) => (cur === href ? null : cur));
    }, 280);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-[720px]">
        <div
          className={cn(
            "mx-3 mb-3 rounded-3xl border shadow-soft",
            // ✅ Faceit-like glass in arena
            isArena ? "bg-black/55 backdrop-blur-xl border-white/12" : "bg-bg/80 backdrop-blur-md border-white/10"
          )}
        >
          <div className="grid grid-cols-5">
            {isArena
              ? arenaItems.map((it) => {
                  const active = it.isActive ? it.isActive(pathname || "") : pathname === it.href;
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      className={cn(
                        "relative py-3 flex flex-col items-center justify-center gap-1 select-none",
                        "transition-transform duration-150 active:scale-95",
                        bouncingHref === it.href && "tab-bounce",
                        active ? "text-accent" : "text-white/65"
                      )}
                      onPointerDown={() => triggerBounce(it.href)}
                    >
                      {active ? (
                        <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-9 rounded-b-full bg-accent" />
                      ) : null}

                      <span
                        className={cn(
                          "opacity-90",
                          active ? "opacity-100" : "opacity-75",
                          active ? "drop-shadow-[0_0_14px_rgba(255,42,79,0.35)]" : ""
                        )}
                      >
                        {it.icon}
                      </span>

                      <div className="text-[11px] leading-none">{it.label}</div>
                    </Link>
                  );
                })
              : lobbyItems.map((it) => {
                  const active = pathname === it.href;
                  const label = t(it.labelKey);
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      className={cn(
                        "relative py-3 flex flex-col items-center justify-center gap-1 select-none",
                        "transition-transform duration-150 active:scale-95",
                        bouncingHref === it.href && "tab-bounce",
                        active ? "text-white" : "text-white/60"
                      )}
                      onPointerDown={() => triggerBounce(it.href)}
                    >
                      <Image
                        src={it.pngIcon ?? "/icons/nav/nav-home.png"}
                        alt={label}
                        width={22}
                        height={22}
                        className={cn("opacity-90", active ? "opacity-100" : "opacity-75")}
                        priority={it.href === "/"}
                      />
                      <div className="text-[11px] leading-none">{label}</div>
                    </Link>
                  );
                })}
          </div>
        </div>
      </div>
    </nav>
  );
}