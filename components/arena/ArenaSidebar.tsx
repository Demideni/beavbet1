"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/utils/cn";
import {
  Home,
  Swords,
  Trophy,
  BarChart3,
  Users,
  MessageCircle,
  Settings,
} from "lucide-react";

type Item = {
  href: string;
  label: string;
  icon: any;
  active?: (p: string) => boolean;
  badge?: number;
};

export default function ArenaSidebar({
  unreadDm = 0,
  friendReq = 0,
}: {
  unreadDm?: number;
  friendReq?: number;
}) {
  const p = usePathname() || "/arena";

  const items: Item[] = [
    { href: "/arena", label: "Home", icon: Home, active: (x) => x === "/arena" },
    { href: "/arena/matches", label: "Matchmaking", icon: Swords, active: (x) => x.startsWith("/arena/matches") },
    { href: "/arena/tournaments", label: "Tournaments", icon: Trophy, active: (x) => x.startsWith("/arena/tournaments") },
    { href: "/arena/leaderboard", label: "Leaderboard", icon: BarChart3, active: (x) => x.startsWith("/arena/leaderboard") },
    { href: "/arena/profile?tab=friends", label: "Friends", icon: Users, badge: friendReq, active: (x) => x.startsWith("/arena/profile") },
    { href: "/arena/profile?tab=messages", label: "Messages", icon: MessageCircle, badge: unreadDm, active: (x) => x.startsWith("/arena/profile") },
  ];

  return (
    <aside
      className={cn(
        "hidden md:flex md:flex-col",
        "fixed left-0 top-0 h-screen w-[280px]",
        "bg-black/40 backdrop-blur-xl",
        "border-r border-white/10",
        "z-30"
      )}
    >
      {/* Top spacing equals Topbar height, but topbar is transparent now */}
      <div className="h-16 px-5 flex items-center border-b border-white/5">
        <Link href="/arena" className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center font-extrabold">
            BB
          </div>
          <div className="leading-tight">
            <div className="text-sm font-extrabold tracking-tight text-white">BEAVBET</div>
            <div className="text-[11px] text-white/55 -mt-0.5">ARENA</div>
          </div>
        </Link>
      </div>

      <nav className="px-3 py-3 flex-1 overflow-auto">
        <div className="space-y-1">
          {items.map((it) => {
            const active = it.active ? it.active(p) : p === it.href;
            const Icon = it.icon;
            return (
              <Link
                key={it.label}
                href={it.href}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-2xl",
                  "border border-transparent",
                  active
                    ? "bg-white/8 border-white/10 text-white"
                    : "text-white/70 hover:text-white hover:bg-white/6"
                )}
              >
                <span
                  className={cn(
                    "size-10 rounded-2xl flex items-center justify-center border",
                    active ? "bg-accent/15 border-accent/20" : "bg-white/5 border-white/10"
                  )}
                >
                  <Icon className={cn("size-5", active ? "text-accent" : "text-white/75")} />
                </span>
                <span className={cn("text-sm font-semibold tracking-tight", active ? "text-white" : "text-white/80")}>
                  {it.label}
                </span>

                {it.badge && it.badge > 0 ? (
                  <span className="ml-auto min-w-6 h-6 px-2 rounded-full bg-accent text-black text-[11px] font-extrabold flex items-center justify-center">
                    {it.badge > 99 ? "99+" : it.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="p-3 border-t border-white/10">
        <Link
          href="/arena/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-white/70 hover:text-white hover:bg-white/6"
        >
          <span className="size-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Settings className="size-5" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Settings</span>
        </Link>
      </div>
    </aside>
  );
}