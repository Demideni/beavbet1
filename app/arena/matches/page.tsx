"use client";

import { useState } from "react";
import ArenaShell from "../ArenaShell";
import { FaceitButton } from "@/components/ui/FaceitButton";
import { cn } from "@/components/utils/cn";
import { Crosshair } from "lucide-react";

const TEAM_SIZES = [
  { v: 1, label: "1v1" },
  { v: 2, label: "2v2" },
  { v: 3, label: "3v3" },
  { v: 5, label: "5v5" },
] as const;

export default function ArenaMatchesPage() {
  const [map, setMap] = useState<string>("random");
  const [teamSize, setTeamSize] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  async function play() {
    setBusy(true);
    try {
      const r = await fetch("/api/arena/duels/cs2/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ teamSize, map }), // ✅ ставок нет
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        if (j?.error === "PREMIUM_REQUIRED") {
          // лимит исчерпан -> отправляем на подписку
          window.location.href = "/arena/premium";
          return;
        }
        if (j?.error === "ALREADY_HAS_DUEL" && j?.duelId) {
          window.location.href = `/arena/duels/cs2/${j.duelId}`;
          return;
        }
        throw new Error(j?.error || "Ошибка");
      }

      if (j?.duelId) window.location.href = `/arena/duels/cs2/${j.duelId}`;
      else window.location.href = "/arena/duels/cs2";
    } catch (e: any) {
      alert(e?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ArenaShell>
      <div className="mx-auto max-w-[1100px]">
        <div className="rounded-3xl border border-white/10 bg-black/30 p-5 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-white text-3xl font-extrabold">Matchmaking</div>
              <div className="mt-1 text-white/60 text-sm">
                3 бесплатных матча в день. Дальше — Premium.
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
            {/* Left */}
            <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
              <div className="flex items-center gap-2 text-white font-extrabold">
                <Crosshair className="h-5 w-5" /> Настройки матча
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Players scroll */}
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-white/60 text-xs font-semibold tracking-[0.18em] uppercase">
                    Кол-во игроков
                  </div>

                  <div className="mt-3 -mx-2 px-2 overflow-x-auto">
                    <div className="flex gap-2 min-w-max">
                      {TEAM_SIZES.map((t) => (
                        <button
                          key={t.v}
                          onClick={() => setTeamSize(t.v)}
                          className={cn(
                            "px-4 py-2 rounded-2xl border text-sm font-semibold transition",
                            teamSize === t.v
                              ? "bg-orange-500 text-black border-orange-500"
                              : "bg-white/6 text-white/85 border-white/10 hover:bg-white/10"
                          )}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2 text-white/45 text-xs">
                    Выбор формата как скролл-кнопки (как на мобилке).
                  </div>
                </div>

                {/* Map */}
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-white/60 text-xs font-semibold tracking-[0.18em] uppercase">Карта</div>
                  <select
                    value={map}
                    onChange={(e) => setMap(e.target.value)}
                    className="mt-3 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white/90"
                  >
                    <option value="random">Random</option>
                    {["de_mirage","de_inferno","de_ancient","de_nuke","de_anubis","de_overpass","de_vertigo"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <div className="mt-2 text-white/45 text-xs">Для «random» карта выбирается автоматически.</div>
                </div>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <FaceitButton onClick={play} disabled={busy} variant="primary" size="lg" className="w-full sm:w-auto">
                  {busy ? "Запуск…" : "Play"}
                </FaceitButton>
                <div className="text-white/55 text-sm">
                  Запускаем матч без ставок. Лимит 3/день без Premium.
                </div>
              </div>
            </div>

            {/* Right summary */}
            <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
              <div className="text-white font-extrabold">Сводка</div>
              <div className="mt-3 grid gap-2">
                <SummaryRow k="Game" v="CS2" />
                <SummaryRow k="Format" v={`${teamSize}v${teamSize}`} />
                <SummaryRow k="Map" v={map} />
              </div>

              <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4 text-white/70 text-sm">
                Premium: $9.99/месяц. При регистрации — 7 дней Premium в подарок.
              </div>
            </div>
          </div>
        </div>
      </div>
    </ArenaShell>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-2xl bg-white/5 border border-white/10 px-4 py-2")}>
      <div className="text-white/55 text-sm">{k}</div>
      <div className="text-white font-semibold truncate">{v}</div>
    </div>
  );
}