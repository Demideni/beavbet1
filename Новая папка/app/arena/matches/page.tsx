"use client";

import { useMemo, useState } from "react";
import ArenaShell from "../ArenaShell";
import { FaceitButton } from "@/components/ui/FaceitButton";
import { cn } from "@/components/utils/cn";
import { Crosshair, ShieldCheck, Swords } from "lucide-react";

type Mode = "classic" | "aim" | "knife";

export default function ArenaMatchesPage() {
  const [mode, setMode] = useState<Mode>("classic");
  const [map, setMap] = useState<string>("random");
  const [stakePreset, setStakePreset] = useState<number>(5);
  const [customStake, setCustomStake] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const stake = useMemo(() => {
    const s = customStake.trim() ? Number(customStake) : stakePreset;
    return Number.isFinite(s) ? s : 0;
  }, [customStake, stakePreset]);

  async function play() {
    if (!Number.isFinite(stake) || stake < 1 || stake > 1000) {
      alert("Некорректная ставка (1 - 1000 EUR)");
      return;
    }
    setBusy(true);
    try {
      // Backend currently supports CS2 duels. Mode is visual-only for now.
      const r = await fetch("/api/arena/duels/cs2/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stake, currency: "EUR", teamSize: 1, map }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j?.error === "ALREADY_HAS_DUEL" && j?.duelId) {
          window.location.href = `/arena/duels/cs2/${j.duelId}`;
          return;
        }
        throw new Error(j?.error || "Ошибка");
      }
      window.dispatchEvent(new Event("wallet:refresh"));
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-white text-3xl font-extrabold">1v1 Matches</div>
              <div className="mt-1 text-white/60 text-sm">Очередь, режимы, ставки — как в FACEIT.</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-11 w-11 rounded-2xl bg-white/6 border border-white/10 grid place-items-center">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div className="h-11 w-11 rounded-2xl bg-white/6 border border-white/10 grid place-items-center">
                <Swords className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
            {/* Left: queue config */}
            <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
              <div className="flex items-center gap-2 text-white font-extrabold">
                <Crosshair className="h-5 w-5" /> Настройки матча
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-white/60 text-xs font-semibold tracking-[0.18em] uppercase">Режим</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(
                      [
                        { id: "classic", label: "Classic" },
                        { id: "aim", label: "AIM" },
                        { id: "knife", label: "Knife" },
                      ] as const
                    ).map((m) => (
                      <FaceitButton
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        variant={mode === m.id ? "primary" : "secondary"}
                        size="sm"
                      >
                        {m.label}
                      </FaceitButton>
                    ))}
                  </div>
                  <div className="mt-2 text-white/45 text-xs">Пока влияет только на UI. Сервера подключим позже.</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-white/60 text-xs font-semibold tracking-[0.18em] uppercase">Карта</div>
                  <select
                    value={map}
                    onChange={(e) => setMap(e.target.value)}
                    className="mt-3 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white/90"
                  >
                    <option value="random">Random</option>
                    {[
                      "de_mirage",
                      "de_inferno",
                      "de_ancient",
                      "de_nuke",
                      "de_anubis",
                      "de_overpass",
                      "de_vertigo",
                    ].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 text-white/45 text-xs">Для «random» карта выбирается автоматически.</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-white/60 text-xs font-semibold tracking-[0.18em] uppercase">Ставка (EUR)</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[5, 10, 20].map((s) => (
                      <FaceitButton
                        key={s}
                        onClick={() => {
                          setStakePreset(s);
                          setCustomStake("");
                        }}
                        variant={!customStake && stakePreset === s ? "primary" : "secondary"}
                        size="sm"
                      >
                        {s}
                      </FaceitButton>
                    ))}
                  </div>
                  <div className="mt-2">
                    <input
                      value={customStake}
                      onChange={(e) => setCustomStake(e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal"
                      placeholder="Или своя ставка (1 - 1000)"
                      className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white/90 placeholder:text-white/30"
                    />
                  </div>
                  <div className="mt-2 text-white/45 text-xs">Комиссия 15% от банка. Победитель забирает остальное.</div>
                </div>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <FaceitButton onClick={play} disabled={busy} variant="primary" size="lg" className="w-full sm:w-auto">
                  {busy ? "Запуск…" : "Play"}
                </FaceitButton>
                <div className="text-white/55 text-sm">Создаём дуэль и запускаем ready-check.</div>
              </div>
            </div>

            {/* Right: summary card */}
            <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
              <div className="text-white font-extrabold">Сводка</div>
              <div className="mt-3 grid gap-2">
                <SummaryRow k="Game" v="CS2" />
                <SummaryRow k="Format" v="1v1" />
                <SummaryRow k="Mode" v={mode.toUpperCase()} />
                <SummaryRow k="Map" v={map} />
                <SummaryRow k="Stake" v={`${stake || 0} EUR`} />
              </div>
              <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4 text-white/70 text-sm">
                Если уже есть активная дуэль — кнопка перенаправит тебя туда.
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
