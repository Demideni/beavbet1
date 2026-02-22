"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function TopTournaments() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"daily" | "monthly">("daily");
  const router = useRouter();

  const bg = tab === "monthly" ? "/banners/montlytour.png" : "/banners/dilytour.png";

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xl font-bold">
          <span className="text-red-500">TOP</span>{" "}
          <span className="text-white">{t("tournaments.top")}</span>
        </div>

        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setTab("daily")}
            className={`px-3 py-1 rounded-lg border ${
              tab === "daily" ? "bg-white/15 border-white/30 text-white" : "bg-white/5 border-white/10 text-white/60"
            }`}
          >
            {t("tournaments.daily")}
          </button>
          <button
            onClick={() => setTab("monthly")}
            className={`px-3 py-1 rounded-lg border ${
              tab === "monthly"
                ? "bg-white/15 border-white/30 text-white"
                : "bg-white/5 border-white/10 text-white/60"
            }`}
          >
            {t("tournaments.monthly")}
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-xl">
        <picture>
          <source media="(max-width: 640px)" srcSet={bg} />
          <img src={bg} alt={t("tournaments.bannerAlt")} className="absolute inset-0 h-full w-full object-cover" />
        </picture>

        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/30" />

        <div className="relative p-6 min-h-[200px] flex flex-col justify-between">
          <div>
            <div className="text-white/70 text-sm">Robinson</div>
            <div className="text-2xl font-bold text-white mt-1">
              {tab === "monthly" ? t("tournaments.monthlyTitle") : t("tournaments.dailyTitle")}
            </div>
            <div className="text-white/70 mt-2">
              {tab === "monthly" ? t("tournaments.monthlyPool") : t("tournaments.dailyPool")}
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
            {t("tournaments.play")}
          </button>
        </div>
      </div>
    </div>
  );
}
