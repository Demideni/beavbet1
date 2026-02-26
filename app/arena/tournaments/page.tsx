"use client";

import { useEffect, useMemo, useState } from "react";
import ArenaShell from "../ArenaShell";
import Link from "next/link";
import { cn } from "@/components/utils/cn";
import { FaceitButton } from "@/components/ui/FaceitButton";
import { Brackets, Clock, Trophy } from "lucide-react";

type Tournament = {
  id: string;
  title: string;
  game: string;
  teamSize: number;
  entryFee: number;
  currency: string;
  maxPlayers: number;
  players: number;
  status: "open" | "live" | "done";
  startsAt?: number | null;
};

function nextHalfHour(ts = Date.now()) {
  const d = new Date(ts);
  d.setSeconds(0);
  d.setMilliseconds(0);
  const m = d.getMinutes();
  const next = m < 30 ? 30 : 60;
  d.setMinutes(next);
  if (next === 60) d.setHours(d.getHours() + 1), d.setMinutes(0);
  return d.getTime();
}

export default function ArenaTournamentsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState<Tournament[]>([]);
  const [mounted, setMounted] = useState(false);
  const [nextStart, setNextStart] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/arena/tournaments", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setRows(j?.tournaments ?? []);
    setLoading(false);
  }

  useEffect(() => {
    setMounted(true);
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  // IMPORTANT: avoid hydration mismatch.
  // Date.now() during render produces different HTML on server vs client, which crashes hydration (React #310/#418).
  useEffect(() => {
    setNextStart(nextHalfHour(Date.now()));
  }, []);

  const every30 = useMemo(() => {
    if (!nextStart) return "";
    const d = new Date(nextStart);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }, [nextStart]);

  async function join(id: string) {
    setBusy(id);
    try {
      const r = await fetch(`/api/arena/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Join failed");
      await load();
      window.dispatchEvent(new Event("wallet:refresh"));
    } catch (e: any) {
      alert(e?.message || "Join failed");
    } finally {
      setBusy(null);
    }
  }

  const visible = useMemo(() => (rows || []).filter((t) => t?.status !== "done"), [rows]);

  return (
    <ArenaShell>
      <div className="mx-auto max-w-[1400px]">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
          <main className="min-w-0">
            <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white text-3xl font-extrabold">Tournaments</div>
                  <div className="mt-1 text-white/60 text-sm">Сетка туриков + старт каждые 30 минут.</div>
                </div>
                <Link href="/arena" className="text-white/80 hover:text-white text-sm">
                  Back →
                </Link>
              </div>

              <div className="mt-5 grid gap-3">
                {loading ? (
                  <div className="text-white/60">Loading…</div>
                ) : visible.length === 0 ? (
                  <div className="text-white/60">Нет турниров</div>
                ) : (
                  visible.map((t) => {
                    const pct = Math.round((Number(t.players || 0) / Math.max(1, Number(t.maxPlayers || 1))) * 100);
                    const isOpen = t.status === "open";
                    return (
                      <div key={t.id} className="rounded-3xl border border-white/10 bg-black/25 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-white font-extrabold truncate">
                              {t.game.toUpperCase()} • {t.title}
                            </div>
                            <div className="mt-1 text-white/60 text-sm">
                              {t.teamSize}v{t.teamSize} • Entry <span className="text-white/85 font-semibold">{t.entryFee} {t.currency}</span> • {t.players}/{t.maxPlayers}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/arena/${t.id}`}
                              className="px-4 py-2 rounded-2xl bg-white/6 border border-white/10 hover:bg-white/10 text-sm text-white/85"
                            >
                              Open
                            </Link>
                            <FaceitButton
                              onClick={() => join(t.id)}
                              disabled={!isOpen || busy === t.id}
                              variant={isOpen ? "primary" : "secondary"}
                              size="md"
                              className={!isOpen ? "opacity-60" : undefined}
                            >
                              {isOpen ? (busy === t.id ? "…" : "JOIN") : t.status.toUpperCase()}
                            </FaceitButton>
                          </div>
                        </div>

                        <div className="mt-4 h-2 rounded-full bg-white/8 overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>

                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="text-white/70 text-xs font-semibold tracking-[0.18em] uppercase flex items-center gap-2">
                            <Brackets className="h-4 w-4" /> Bracket (preview)
                          </div>
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                            {["QF", "SF", "F", "WIN"].map((r) => (
                              <div key={r} className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
                                <div className="text-white/55 text-xs">{r}</div>
                                <div className="text-white/80 text-sm mt-1">TBD</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </main>

          <aside className="h-fit grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center justify-between">
                <div className="text-white font-extrabold">Каждые 30 минут</div>
                <Clock className="h-5 w-5 text-white/70" />
              </div>
              <div className="mt-3 text-white/70 text-sm">
                Следующий старт: <span className="text-white font-semibold">{mounted ? every30 : "—"}</span>
              </div>
              <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4 text-white/60 text-sm">
                Это витрина расписания (как у FACEIT). Фактические старты можно привязать к cron позже.
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center justify-between">
                <div className="text-white font-extrabold">Prize pool</div>
                <Trophy className="h-5 w-5 text-white/70" />
              </div>
              <div className="mt-3 grid gap-2">
                {visible.slice(0, 3).map((t) => (
                  <div key={t.id} className={cn("rounded-2xl border border-white/10 bg-white/5 px-4 py-3")}> 
                    <div className="text-white/85 font-semibold truncate">{t.title}</div>
                    <div className="text-white/55 text-sm mt-0.5">
                      Pool ≈ <span className="text-white/85 font-semibold">{Number(t.players || 0) * Number(t.entryFee || 0)} {t.currency}</span>
                    </div>
                  </div>
                ))}
                {!visible.length ? <div className="text-white/60">—</div> : null}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </ArenaShell>
  );
}
