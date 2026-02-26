"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/components/utils/cn";
import { useI18n } from "@/components/i18n/I18nProvider";

const items: Array<{
  href: string;
  labelKey: string;
  pngIcon?: string;
}> = [
  { href: "/", labelKey: "nav.home", pngIcon: "/icons/nav/nav-home.png" },
  { href: "/casino", labelKey: "nav.casino", pngIcon: "/icons/nav/nav-casino.png" },
  // Arena between Casino and Sport
  { href: "/arena", labelKey: "nav.arena", pngIcon: "/icons/nav/nav-arena.png" },
  { href: "/sport", labelKey: "nav.sport", pngIcon: "/icons/nav/nav-sport.png" },
  { href: "/tournaments", labelKey: "nav.tournaments", pngIcon: "/icons/nav/nav-tournaments.png" },
];

export function MobileNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [bouncingHref, setBouncingHref] = useState<string | null>(null);

  if (!mounted) return null;

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
            isArena ? "bg-black/55 backdrop-blur-xl border-white/12" : "bg-bg/80 backdrop-blur-md border-white/10"
          )}
        >
          <div className="grid grid-cols-5">
            {items.map((it) => {
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
                    isArena ? (active ? "text-accent" : "text-white/65") : active ? "text-white" : "text-white/60"
                  )}
                  onPointerDown={() => triggerBounce(it.href)}
                >
                  {isArena && active ? (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-9 rounded-b-full bg-accent" />
                  ) : null}
                  <Image
                    src={it.pngIcon ?? "/icons/nav/nav-home.png"}
                    alt={label}
                    width={22}
                    height={22}
                    className={cn(
                      "opacity-90",
                      active ? "opacity-100" : "opacity-75",
                      isArena && active ? "drop-shadow-[0_0_14px_rgba(255,42,79,0.35)]" : ""
                    )}
                    priority={it.href === "/"}
                  />
                  <div className="text-[11px] leading-none">
                    {label}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
