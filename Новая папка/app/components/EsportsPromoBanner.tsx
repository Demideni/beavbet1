"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function EsportsPromoBanner() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="mt-4">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-xl">
        {/* фон с поддержкой mobile/desktop */}
        <picture>
          <source media="(max-width: 640px)" srcSet="/banners/kiber.png" />
          <img
            src="/banners/kiber.png"
            alt={t("home.esports.alt")}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </picture>

        {/* затемнение */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/25" />

        {/* контент */}
        <div className="relative p-5 sm:p-7 min-h-[180px] flex flex-col justify-center">
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            <span className="text-red-400">{t("home.esports.headlineA")}</span>
            <span className="text-white"> {t("home.esports.headlineB")}</span>
          </div>

          <div className="mt-2 text-white/70 text-sm sm:text-base">CS2 • Dota 2 • LoL</div>

          <button
            onClick={() => router.push("/sport?tab=esports")}
            className="
              mt-4 w-full sm:w-fit
              rounded-2xl px-6 py-3
              bg-gradient-to-r from-red-500 to-rose-500
              text-white font-semibold
              shadow-lg
              hover:brightness-110 active:brightness-95
            "
          >
            {t("home.esports.cta")}
          </button>
        </div>
      </div>
    </div>
  );
}
