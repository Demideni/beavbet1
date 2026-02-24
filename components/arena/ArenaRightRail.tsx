import Link from "next/link";
import { cn } from "@/components/utils/cn";
import { Trophy, Flame, Clock, Users } from "lucide-react";

export default function ArenaRightRail() {
  return (
    <aside className="hidden xl:block w-[360px] shrink-0">
      <div className="sticky top-20 space-y-3">
        {/* Connect game card */}
        <div className={cn("rounded-3xl border border-white/10 bg-white/4 p-4")}>
          <div className="flex items-start gap-3">
            <img
              src="/arena/ui/connect-game.png"
              alt=""
              className="size-12 rounded-2xl border border-white/10 bg-black/30 object-cover"
              onError={(e) => ((e.currentTarget.style.display = "none"), null)}
            />
            <div className="min-w-0">
              <div className="text-sm font-extrabold tracking-tight text-white">Connect your game</div>
              <div className="text-xs text-white/65 mt-0.5">
                Link CS2 / Dota2 to verify matches & start instantly.
              </div>
            </div>
          </div>

          <Link
            href="/arena/connect"
            className="mt-3 inline-flex w-full items-center justify-center h-11 rounded-2xl btn-accent font-extrabold"
          >
            Connect game
          </Link>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
              <div className="text-[11px] text-white/60">Status</div>
              <div className="text-xs font-bold text-white mt-0.5">Ready</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
              <div className="text-[11px] text-white/60">Ping</div>
              <div className="text-xs font-bold text-white mt-0.5">Good</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
              <div className="text-[11px] text-white/60">Region</div>
              <div className="text-xs font-bold text-white mt-0.5">EU</div>
            </div>
          </div>
        </div>

        {/* Activity */}
        <div className={cn("rounded-3xl border border-white/10 bg-white/4 p-4")}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold tracking-tight text-white">Activity</div>
            <Link href="/arena/activity" className="text-xs text-white/60 hover:text-white">
              View
            </Link>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
              <span className="size-9 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center">
                <Flame className="size-4 text-accent" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Win streak challenge</div>
                <div className="text-[11px] text-white/60">Get bonus for 3 wins in a row</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
              <span className="size-9 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center">
                <Trophy className="size-4 text-white/80" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Blitz Cup</div>
                <div className="text-[11px] text-white/60">Every 30 minutes • 8 players</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
              <span className="size-9 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center">
                <Users className="size-4 text-white/80" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Clans</div>
                <div className="text-[11px] text-white/60">Create a clan & win wars</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
              <span className="size-9 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center">
                <Clock className="size-4 text-white/80" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Next match</div>
                <div className="text-[11px] text-white/60">Queue is live now</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}