"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import ArenaChatWidget from "@/components/arena/ArenaChatWidget";
import { cn } from "@/components/utils/cn";
import {
  Search,
  Users,
  Play,
  BarChart3,
  Radar,
  Eye,
  Newspaper,
  Store,
  Crown,
  ChevronLeft,
  X,
  MessageCircle,
} from "lucide-react";

export default function ArenaShell({ children }: { children: ReactNode }) {
  const [showBar, setShowBar] = useState(false);
  const [q, setQ] = useState("");

  // Avoid focus jumps in Safari on first render.
  useEffect(() => {
    const t = setTimeout(() => setQ((v) => v), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative min-h-screen">
      <div className="cs2-shell-bg" aria-hidden />
      <div className="cs2-fx" aria-hidden>
        <div className="cs2-glow" />
        <div className="cs2-scanlines" />
        <div className="cs2-noise" />
        <div className="cs2-vignette" />
      </div>

      {/* FACEIT-like announcement bar */}
      {showBar && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div className="bg-accent text-black">
            <div className="mx-auto max-w-[1400px] px-3 py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-extrabold">
                <ChevronLeft className="h-4 w-4" />
                <span className="tracking-wide">Запускайте BEAVBET ARENA прямо с рабочего стола!</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-4 py-1.5 rounded-xl bg-black/20 border border-black/20 hover:bg-black/25 text-xs font-extrabold"
                  onClick={() => alert("Desktop client скоро. Пока играем в браузере.")}
                >
                  СКАЧАТЬ
                </button>
                <button
                  type="button"
                  aria-label="Close"
                  className="h-8 w-8 grid place-items-center rounded-xl hover:bg-black/10"
                  onClick={() => setShowBar(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 pt-0">
        <div className="flex">
          {/* Left sidebar */}
          <aside className="hidden md:flex w-[260px] shrink-0">
            {/* Fixed + flush to the left edge (global sidebar is hidden in /arena) */}
            <div className="fixed top-0 bottom-0 left-0 w-[260px]">
              <div className="h-full border-r border-white/10 bg-black/35 backdrop-blur-xl pt-16 flex flex-col overflow-hidden">

                {/* Scrollable area (prevents the bottom chat from pushing outside the viewport) */}
                <div className="flex-1 min-h-0 overflow-y-auto">

                <div className="px-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/45" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Поиск"
                      className="w-full rounded-2xl bg-white/5 border border-white/10 pl-9 pr-3 py-2 text-sm text-white/85 placeholder:text-white/35 outline-none focus:border-white/20"
                    />
                  </div>
                </div>

                <nav className="mt-4 px-2 grid gap-1">
                  <SideLink href="/arena" icon={<Play className="h-4 w-4" />} label="Играть" active />
                  <SideLink href="/arena/profile?tab=friends" icon={<Users className="h-4 w-4" />} label="Друзья" />
                  <SideLink href="/arena/profile?tab=messages" icon={<MessageCircle className="h-4 w-4" />} label="Сообщения" />
                  <SideLink href="/arena/leaderboard" icon={<BarChart3 className="h-4 w-4" />} label="Ранг" />
                  <SideLink href="/arena/matches" icon={<Radar className="h-4 w-4" />} label="Track" />
                  <SideLink href="#" icon={<Eye className="h-4 w-4" />} label="Watch" disabled />
                  <SideLink href="#" icon={<Newspaper className="h-4 w-4" />} label="Лента" disabled />
                </nav>

                <div className="mt-6 px-4">
                  <div className="text-white/55 text-xs font-semibold uppercase tracking-[0.18em]">Клубы</div>
                  <div className="mt-2 grid gap-1">
                    <SideLink href="/arena/clans" icon={<Users className="h-4 w-4" />} label="Клубы" />
                    <SideLink href="/arena/clans" icon={<Users className="h-4 w-4" />} label="Создать клуб" />
                  </div>
                </div>

                <div className="mt-6 px-4">
                  <div className="text-white/55 text-xs font-semibold uppercase tracking-[0.18em]">Другое</div>
                  <div className="mt-2 grid gap-1">
                    <SideLink href="#" icon={<Store className="h-4 w-4" />} label="Магазин" disabled />
                    <SideLink href="#" icon={<Crown className="h-4 w-4" />} label="Премиум" disabled />
                  </div>
                </div>

                </div>

                {/* Embedded global chat (desktop) */}
                <div className="shrink-0 w-full pb-4">
                  <ArenaChatWidget mode="sidebar" />
                </div>
              </div>
            </div>
          </aside>

          {/* Main */}
          <div className="flex-1 min-w-0">
            <div className="cs2-wrap">
              <div className="mx-auto max-w-[1400px] px-3 md:px-6 py-6">{children}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile keeps a floating chat button/panel */}
      <div className="md:hidden">
        <ArenaChatWidget />
      </div>
    </div>
  );
}

function SideLink({
  href,
  icon,
  label,
  disabled,
  active,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  active?: boolean;
}) {
  const base = "group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm border transition-colors";
  const cls = disabled
    ? "bg-white/3 border-white/8 text-white/35 cursor-not-allowed"
    : active
      ? "bg-white/8 border-white/14 text-white"
      : "bg-transparent border-transparent hover:bg-white/6 hover:border-white/10 text-white/80 hover:text-accent";

  if (disabled || href === "#") {
    return (
      <div className={cn(base, cls)}>
        <div className="text-white/70 group-hover:text-accent">{icon}</div>
        <div className="truncate">{label}</div>
      </div>
    );
  }

  return (
    <Link href={href} className={cn(base, cls)}>
      <div className="text-white/70 group-hover:text-accent">{icon}</div>
      <div className="truncate">{label}</div>
    </Link>
  );
}
