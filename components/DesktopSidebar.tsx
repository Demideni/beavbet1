"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const ITEMS = [
  { href: "/menu", label: "Menu", icon: "/icons/menu.png" },
  { href: "/tournaments", label: "Tournaments", icon: "/icons/promotions.png" },
  { href: "/cashier", label: "Cashier", icon: "/icons/wallet.png" },
  { href: "/partners", label: "Partners", icon: "/icons/promotions.png" },
];

function cls(active: boolean) {
  return [
    "group flex items-center gap-3 rounded-2xl border px-3 py-3 transition",
    active
      ? "border-sky-500/40 bg-sky-500/10 text-slate-100"
      : "border-slate-800/70 bg-black/30 text-slate-200 hover:border-slate-700 hover:bg-white/5",
  ].join(" ");
}

export default function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:w-[280px] lg:flex-col lg:gap-3 lg:px-4 lg:py-4">
      <div className="rounded-3xl border border-slate-800/70 bg-black/30 p-4">
        <div className="text-xs text-slate-500">Pulz</div>
        <div className="mt-1 text-lg font-semibold text-slate-100">Robinson</div>
      </div>

      <nav className="rounded-3xl border border-slate-800/70 bg-black/30 p-3">
        <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Navigation
        </div>

        <div className="flex flex-col gap-2">
          {ITEMS.map((it) => {
            const active = pathname === it.href || (it.href !== "/" && pathname?.startsWith(it.href));
            return (
              <Link key={it.href} href={it.href} className={cls(active)}>
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-xl border border-slate-800/60 bg-black/40">
                  <Image src={it.icon} alt="" fill className="object-contain p-1.5" />
                </span>
                <span className="text-sm font-semibold">{it.label}</span>
                <span className="ml-auto text-xs text-slate-500 group-hover:text-slate-400">→</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto rounded-3xl border border-slate-800/70 bg-black/30 p-4 text-xs text-slate-500">
        <div className="font-semibold text-slate-300">Desktop controls</div>
        <div className="mt-2 leading-relaxed">
          Use mouse/touch inside the game. For best feel: full screen in browser (F11).
        </div>
      </div>
    </aside>
  );
}
