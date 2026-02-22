"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

export default function Page() {
  const { t } = useI18n();

  return (
    <div className="rounded-3xl card-glass p-8">
      <div className="text-3xl font-extrabold">{t("security.title")}</div>
      <div className="mt-2 text-white/60">{t("security.placeholder")}</div>
    </div>
  );
}
