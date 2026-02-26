"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

export default function Page() {
  const { t } = useI18n();

  return (
    <div className="rounded-3xl card-glass p-8">
      <div className="text-3xl font-extrabold">VIP</div>
      <div className="mt-2 text-white/60">{t("vip.placeholder")}</div>
    </div>
  );
}
