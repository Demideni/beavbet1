"use client";

import { useRouter } from "next/navigation";

export function EsportsPromoBanner() {
  const router = useRouter();

  return (
    <section className="flex flex-col gap-3">
      <div
        className="
          relative overflow-hidden rounded-3xl
          border border-white/10
          bg-white/5
          shadow-xl
        "
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/12 via-white/6 to-transparent" />
        <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_20%_30%,rgba(59,130,246,.45),transparent_48%),radial-gradient(circle_at_85%_65%,rgba(239,68,68,.22),transparent_52%)]" />

        <div className="relative p-5 sm:p-7">
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            <span className="text-red-400">Киберспорт?</span>
            <span className="text-white"> Ставим</span>
          </div>

          <div className="mt-2 text-white/60 text-sm sm:text-base">
            CS2 • Dota 2 • LoL
          </div>

          <button
            onClick={() => router.push("/sport?tab=esports")}
            className="
              mt-4 w-full sm:w-auto
              rounded-2xl px-6 py-3
              bg-gradient-to-r from-red-500 to-rose-500
              text-white font-semibold
              shadow-lg
              hover:brightness-110 active:brightness-95
            "
          >
            Открыть киберспорт
          </button>
        </div>
      </div>
    </section>
  );
}
