"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";

function Inner() {
  const sp = useSearchParams();
  const initial = sp.get("tab") === "daily" ? "daily" : "monthly";
  const [tab, setTab] = useState<"daily" | "monthly">(initial);

  const card = useMemo(() => {
    if (tab === "daily") {
      return {
        title: "Ежедневный турнир",
        subtitle: "Robinson",
        prize: "$150 призовой фонд",
      };
    }
    return {
      title: "Ежемесячный турнир",
      subtitle: "Robinson",
      prize: "$3000 призовой фонд",
    };
  }, [tab]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-3xl font-extrabold text-white">Турниры</div>
          <div className="mt-2 text-white/60">Ежедневные и ежемесячные турниры в стиле BeavBet.</div>
        </div>

        <Link href="/" className="text-sm text-white/60 hover:text-white/90">
          На главную →
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab("monthly")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            tab === "monthly"
              ? "bg-white/10 text-white"
              : "bg-white/5 text-white/60 hover:text-white/90"
          }`}
        >
          Ежемесячные
        </button>

        <button
          onClick={() => setTab("daily")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            tab === "daily"
              ? "bg-white/10 text-white"
              : "bg-white/5 text-white/60 hover:text-white/90"
          }`}
        >
          Ежедневные
        </button>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <div className="text-white/60 text-sm">{card.subtitle}</div>
        <div className="mt-2 text-3xl font-extrabold text-white leading-tight">{card.title}</div>
        <div className="mt-2 text-white/70 text-lg font-semibold">{card.prize}</div>

        <div className="mt-6 inline-flex rounded-2xl px-6 py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold shadow-lg">
          Играть
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  // useSearchParams requires Suspense
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
