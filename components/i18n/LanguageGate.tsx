"use client";

import { useEffect, useMemo, useState } from "react";
import { LANG_COOKIE, Lang, SUPPORTED_LANGS } from "@/lib/i18n";
import { useI18n } from "./I18nProvider";
import { cn } from "@/components/utils/cn";

const LANG_META: Record<Lang, { labelKey: string; flag: string }> = {
  ru: { labelKey: "lang.russian", flag: "🇷🇺" },
  en: { labelKey: "lang.english", flag: "🇺🇸" },
  es: { labelKey: "lang.spanish", flag: "🇪🇸" },
};

function readCookieLang(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function LanguageGate() {
  const { lang, setLang, t } = useI18n();
  const [ready, setReady] = useState(false);
  const [needsPick, setNeedsPick] = useState(false);

  useEffect(() => {
    // Determine if this is a first visit.
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LANG_COOKIE);
    } catch {
      // ignore
    }
    const cookie = readCookieLang();
    const chosen = stored || cookie;

    if (chosen && SUPPORTED_LANGS.includes(chosen as Lang)) {
      if (chosen !== lang) setLang(chosen as Lang);
      setNeedsPick(false);
    } else {
      setNeedsPick(true);
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = useMemo(() => SUPPORTED_LANGS.map((l) => ({ l, ...LANG_META[l] })), []);

  if (!ready || !needsPick) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-bg/90 shadow-soft p-6">
        <div className="text-white text-xl font-extrabold tracking-tight">{t("lang.chooseTitle")}</div>
        <div className="mt-1 text-white/60 text-sm">{t("lang.chooseSubtitle")}</div>

        <div className="mt-5 grid grid-cols-1 gap-3">
          {options.map(({ l, labelKey, flag }) => (
            <button
              key={l}
              onClick={() => {
                setLang(l);
                setNeedsPick(false);
              }}
              className={cn(
                "w-full flex items-center justify-between gap-3",
                "px-4 py-3 rounded-2xl",
                "bg-white/5 border border-white/10 hover:bg-white/8",
                "text-left text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl leading-none">{flag}</div>
                <div className="font-semibold">{t(labelKey)}</div>
              </div>
              <div className="text-white/45 text-sm">{l.toUpperCase()}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 text-[12px] text-white/45">
          Tip: use the globe icon in the header to switch later.
        </div>
      </div>
    </div>
  );
}
