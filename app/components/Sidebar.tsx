"use client";

import Link from "next/link";
import { User, Crosshair } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/components/utils/cn";
import { useI18n } from "@/components/i18n/I18nProvider";

const items = [
  // Temporary: focus product entry on Arena.
  { href: "/arena", icon: Crosshair, labelKey: "nav.arena" },
  { href: "/account", icon: User, labelKey: "nav.account" },
];

export function Sidebar() {
  const { t } = useI18n();
  const pathname = usePathname();

  // Arena has its own FACEIT-like shell + sidebar.
  // Hide the global sidebar there so the Arena sidebar is flush to the viewport edge.
  if (pathname?.startsWith("/arena")) return null;

  return (
    <aside className="hidden md:flex w-[76px] lg:w-[88px] flex-col items-center gap-2 py-3 border-r border-white/5 bg-bg/40">
      <div className="h-1" />
      {items.map((it) => {
        const active = pathname === it.href;
        const Icon = it.icon;
        const label = t(it.labelKey);
        return (
          <Link
            key={it.href}
            href={it.href}
            title={label}
            className={cn(
              "group relative w-[52px] lg:w-[58px] h-[44px] rounded-2xl",
              "flex items-center justify-center",
              "border border-transparent",
              active
                ? "bg-white/10 border-white/10"
                : "hover:bg-white/6 hover:border-white/10"
            )}
          >
            <Icon className={cn("size-5", active ? "text-accent" : "text-white/70 group-hover:text-white")} />
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-full bg-accent" />
            )}
          </Link>
        );
      })}
      <div className="flex-1" />
      <div className="mb-2 text-[10px] text-white/35">BeavBet</div>
    </aside>
  );
}
