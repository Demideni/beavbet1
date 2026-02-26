"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";

export function CryptoCta() {
  const { t } = useI18n();

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/6 to-white/0 p-5 lg:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xl font-extrabold tracking-tight text-white">{t("cryptoCta.title")}</div>
          <div className="mt-1 text-sm text-white/60">{t("cryptoCta.subtitle")}</div>
        </div>

        <Link
          href="/auth?tab=register"
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 px-5 text-sm font-semibold text-white shadow hover:opacity-95"
        >
          {t("topbar.register")}
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/45">
        <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5">G Pay</span>
        <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5">Apple Pay</span>
        <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5">Mastercard</span>
        <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5">VISA</span>
      </div>
    </section>
  );
}
