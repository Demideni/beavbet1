"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ArenaShell from "../../../ArenaShell";
import { cn } from "@/components/utils/cn";
import { ChevronLeft, Copy, Shield, Swords, Timer, Trophy } from "lucide-react";

type Duel = {
  id: string;
  game: string;
  stake: number;
  currency: string;
  status: string;
  map?: string | null;
  server?: string | null;
  server_password?: string | null;
  join_link?: string | null;
  p1_ready: number;
  p2_ready: number;
  p1_user_id: string;
  p2_user_id: string | null;
  p1_nick?: string | null;
  p2_nick?: string | null;
  winner_nick?: string | null;
  winner_user_id?: string | null;
  me_team: number | null;
  me_ready: boolean;
  ready_deadline?: number | null;
  myRating: number;
  ratingName: string;
};

export default function Cs2DuelRoomClient({ duelId }: { duelId: string }) {
  const [duel, setDuel] = useState<Duel | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const r = await fetch(`/api/arena/duels/cs2/one?id=${encodeURIComponent(duelId)}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (j?.ok) {
      setDuel(j.duel);
      setPlayers(j.players || []);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duelId]);

  const title = useMemo(() => {
    if (!duel) return "Duel";
    return `${duel.p1_nick || "Player"} vs ${duel.p2_nick || "Waiting…"}`;
  }, [duel]);

  const canJoin = duel?.status === "open" && !duel?.me_team;
  const canReady = Boolean(duel?.me_team) && (duel?.status === "active" || duel?.status === "open");

  async function join(team: 1 | 2) {
    if (!duel) return;
    setBusy(`join:${team}`);
    const r = await fetch("/api/arena/duels/cs2/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ duelId: duel.id, team }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) {
      alert(j?.error || "Ошибка");
      return;
    }
    window.dispatchEvent(new Event("wallet:refresh"));
    await load();
  }

  async function ready() {
    if (!duel) return;
    setBusy("ready");
    const r = await fetch("/api/arena/duels/cs2/ready", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ duelId: duel.id }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) {
      alert(j?.error || "Ошибка");
      return;
    }
    await load();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  const deadlineLeft = duel?.ready_deadline ? Math.max(0, duel.ready_deadline - Date.now()) : null;
  const deadlineText = deadlineLeft == null ? null : `${Math.ceil(deadlineLeft / 1000)}s`;

  return (
    <ArenaShell>
      <div className="relative">
        <div className="relative z-10 mx-auto max-w-[1200px] px-4 py-10">
          <div className="flex items-center justify-between gap-3">
            <Link href="/arena/duels/cs2" className="inline-flex items-center gap-2 text-white/80 hover:text-white">
              <ChevronLeft className="h-4 w-4" /> Back to CS2 duels
            </Link>
            <Link href="/arena" className="text-white/80 hover:text-white">Arena →</Link>
          </div>

          <div className="mt-6 rounded-3xl card-glass p-6 relative overflow-hidden">
            {/* cinematic bg */}
            <div className="absolute inset-0 opacity-30" aria-hidden>
              <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-accent/25 blur-3xl" />
              <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            </div>

            <div className="relative">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="text-white/60 text-sm">CS2 Duel</div>
                  <div className="text-white text-2xl md:text-3xl font-extrabold mt-1">{title}</div>
                  <div className="text-white/60 mt-2 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2"><Swords className="h-4 w-4" /> {duel?.map || "Map"}</span>
                    <span className="inline-flex items-center gap-2"><Shield className="h-4 w-4" /> {duel?.status ? String(duel.status).toUpperCase() : ""}</span>
                    {deadlineText ? (
                      <span className="inline-flex items-center gap-2"><Timer className="h-4 w-4" /> Ready in {deadlineText}</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/6 border border-white/10 px-4 py-3">
                    <div className="text-white/60 text-xs">Stake</div>
                    <div className="text-white font-extrabold text-xl mt-1">{duel ? `${duel.stake} ${duel.currency}` : "—"}</div>
                  </div>
                  <div className="rounded-2xl bg-white/6 border border-white/10 px-4 py-3">
                    <div className="text-white/60 text-xs">BeavRank</div>
                    <div className="text-white font-extrabold text-xl mt-1">{duel ? duel.myRating : "—"}</div>
                    <div className="text-white/60 text-xs mt-1">{duel?.ratingName}</div>
                  </div>
                </div>
              </div>

              {/* VS block */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
                <PlayerPanel
                  side="left"
                  nick={duel?.p1_nick || "Player"}
                  ready={Boolean(duel?.p1_ready)}
                  highlight={duel?.me_team === 1}
                />

                <div className="rounded-3xl bg-black/25 border border-white/10 p-5 flex flex-col items-center justify-center text-center">
                  <div className="text-white/60 text-sm">VS</div>
                  <div className="text-5xl font-extrabold text-white mt-2 tracking-tight">VS</div>
                  <div className="text-white/70 mt-3">
                    Prize pool: <span className="text-white font-semibold">{duel ? (duel.stake * 2).toFixed(2) : "—"}</span> {duel?.currency}
                  </div>
                  <div className="text-white/50 text-xs mt-2">Rake 15% • автоматические выплаты</div>

                  <div className="mt-5 w-full grid grid-cols-1 gap-2">
                    {canJoin ? (
                      <>
                        <button
                          onClick={() => join(1)}
                          disabled={busy === "join:1"}
                          className={cn("cs2-btn", busy === "join:1" && "opacity-70")}
                        >
                          Join Team 1
                        </button>
                        <button
                          onClick={() => join(2)}
                          disabled={busy === "join:2"}
                          className={cn("cs2-btn", busy === "join:2" && "opacity-70")}
                        >
                          Join Team 2
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={ready}
                        disabled={!canReady || busy === "ready" || Boolean(duel?.me_ready)}
                        className="cs2-btn disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {duel?.me_ready ? "READY ✓" : busy === "ready" ? "…" : "READY"}
                      </button>
                    )}
                  </div>
                </div>

                <PlayerPanel
                  side="right"
                  nick={duel?.p2_nick || "Waiting…"}
                  ready={Boolean(duel?.p2_ready)}
                  highlight={duel?.me_team === 2}
                />
              </div>

              {/* Server block */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-3xl bg-white/6 border border-white/10 p-5">
                  <div className="text-white font-semibold">Server</div>
                  <div className="text-white/60 text-sm mt-1">Появится после READY обоих игроков.</div>

                  <div className="mt-4 grid gap-2">
                    <InfoRow label="Address" value={duel?.server || "—"} onCopy={duel?.server ? () => copy(String(duel.server)) : undefined} />
                    <InfoRow
                      label="Password"
                      value={duel?.server_password ? "••••••" : "—"}
                      onCopy={duel?.server_password ? () => copy(String(duel.server_password)) : undefined}
                    />
                    <InfoRow
                      label="Join link"
                      value={duel?.join_link || "—"}
                      onCopy={duel?.join_link ? () => copy(String(duel.join_link)) : undefined}
                    />
                  </div>
                </div>

                <div className="rounded-3xl bg-white/6 border border-white/10 p-5">
                  <div className="text-white font-semibold">Match rules</div>
                  <div className="text-white/60 text-sm mt-1">MVP-style: winner takes all (minus rake).</div>
                  <ul className="mt-4 space-y-2 text-white/75 text-sm">
                    <li>• READY-check: 60s, иначе дуэль отменится и деньги вернутся.</li>
                    <li>• Победа фиксируется по отчёту/серверу (в будущем: авто-валидатор).</li>
                    <li>• Споры → pending_review (в будущем: античит/демо).</li>
                  </ul>

                  {duel?.status === "done" ? (
                    <div className="mt-4 rounded-2xl bg-black/25 border border-white/10 p-4">
                      <div className="text-white/70 text-sm">Winner</div>
                      <div className="text-white text-xl font-extrabold mt-1 inline-flex items-center gap-2">
                        <Trophy className="h-5 w-5" /> {duel.winner_nick || "—"}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Debug / players list (hidden-ish) */}
              <div className="mt-6 rounded-3xl bg-black/20 border border-white/10 p-4">
                <div className="text-white/70 text-sm">Players</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {players.map((p) => (
                    <span
                      key={`${p.user_id}:${p.team}`}
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-white/85 text-sm"
                    >
                      {p.nickname || "Player"} <span className="text-white/40">T{p.team}</span> {p.ready ? "✓" : ""}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ArenaShell>
  );
}

function PlayerPanel({
  side,
  nick,
  ready,
  highlight,
}: {
  side: "left" | "right";
  nick: string;
  ready: boolean;
  highlight: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-black/25 border p-5 flex flex-col justify-between",
        highlight ? "border-accent/60" : "border-white/10"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-white/60 text-sm">{side === "left" ? "Player 1" : "Player 2"}</div>
          <div className="text-white text-xl font-extrabold mt-1 truncate">{nick}</div>
        </div>
        <div className={cn("rounded-full px-3 py-1 text-xs border", ready ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/15 bg-white/5 text-white/60")}>{ready ? "READY" : "NOT READY"}</div>
      </div>

      <div className="mt-6">
        <div className="h-2 rounded-full bg-white/8 overflow-hidden">
          <div className={cn("h-full", ready ? "bg-emerald-400/70" : "bg-white/10")} style={{ width: ready ? "100%" : "40%" }} />
        </div>
        <div className="text-white/55 text-xs mt-2">"{ready ? "Locked in" : "Waiting for ready"}"</div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/25 border border-white/10 px-3 py-2">
      <div>
        <div className="text-white/55 text-xs">{label}</div>
        <div className="text-white/85 text-sm break-all">{value}</div>
      </div>
      {onCopy ? (
        <button onClick={onCopy} className="h-9 w-9 rounded-2xl bg-white/6 border border-white/10 hover:bg-white/10 flex items-center justify-center" aria-label="Copy">
          <Copy className="h-4 w-4 text-white" />
        </button>
      ) : null}
    </div>
  );
}
