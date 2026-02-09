"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TopTournaments() {
  const [tab, setTab] = useState<"daily" | "monthly">("daily");
  const router = useRouter();

  const bg = tab === "monthly"
    ? "/banners/montlytour.png"
    : "/banners/dilytour.png";

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xl font-bold">
          <span className="text-red-500">ТОП</span>{" "}
          <span className="text-white">Турниры</span>
        </div>

        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setTab("daily")}
            className={`px-3 py-1 rounded-lg border ${
              tab === "daily"
                ? "bg-white/15 border-white/30 text-white"
                : "bg-white/5 border-white/10 text-white/60"
            }`}
          >
            Ежедневные
          </button>
          <button
            onClick={() => setTab("monthly")}
            className={`px-3 py-1 rounded-lg border ${
              tab === "monthly"
                ? "bg-white/15 border-white/30 text-white"
                : "bg-white/5 border-white/10 text-white/60"
            }`}
          >
            Ежемесячные
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-xl">
        {/* фон */}
        <picture>
          <source media="(max-width: 640px)" srcSet={bg} />
          <img
            src={bg}
            alt="Tournament"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </picture>

        {/* затемнение */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/30" />

        {/* контент */}
        <div className="relative p-6 min-h-[200px] flex flex-col justify-between">
          <div>
            <div className="text-white/70 text-sm">Robinson</div>
            <div className="text-2xl font-bold text-white mt-1">
              {tab === "monthly" ? "Ежемесячный турнир" : "Ежедневный турнир"}
            </div>
            <div className="text-white/70 mt-2">
              {tab === "monthly" ? "$3000 призовой фонд" : "$150 призовой фонд"}
            </div>
          </div>

          <button
            onClick={() => router.push("/tournaments")}
            className="
              mt-4 w-fit
              rounded-2xl px-6 py-3
              bg-gradient-to-r from-red-500 to-rose-500
              text-white font-semibold
              shadow-lg
              hover:brightness-110 active:brightness-95
            "
          >
            Играть
          </button>
        </div>
      </div>
    </div>
  );
}
