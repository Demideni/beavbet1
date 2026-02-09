"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type TournamentCard = {
  key: string;
  title: string;
  subtitle: string;
  prize: string;
  href: string;
};

export function TopTournaments() {
  const [tab, setTab] = useState<"daily" | "monthly">("monthly");

  const cards = useMemo<TournamentCard[]>(() => {
    if (tab === "daily") {
      return [
        {
          key: "robinson-daily",
          title: "Ежедневный турнир",
          subtitle: "Robinson",
          prize: "$150 призовой фонд",
          href: "/tournaments?tab=daily",
        },
      ];
    }
    return [
      {
        key: "robinson-monthly",
        title: "Ежемесячный турнир",
        subtitle: "Robinson",
        prize: "$3000 призовой фонд",
        href: "/tournaments?tab=monthly",
      },
    ];
  }, [tab]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold text-white/90">
          <span className="text-accent">ТОП</span> Турниры
        </div>

        <Link href="/tournaments" className="text-sm text-white/60 hover:text-white/90">
          Смотреть все →
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            className="
              rounded-3xl border border-white/10 bg-white/5
              p-6 shadow-xl
              hover:bg-white/7 transition
            "
          >
            <div className="text-white/60 text-sm">{c.subtitle}</div>
            <div className="mt-2 text-2xl font-extrabold text-white leading-tight">{c.title}</div>
            <div className="mt-2 text-white/70 text-lg font-semibold">{c.prize}</div>

            <div className="mt-6 inline-flex rounded-2xl px-6 py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold shadow-lg">
              Играть
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
