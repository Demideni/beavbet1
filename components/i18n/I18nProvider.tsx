"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { DEFAULT_LANG, isLang, LANG_COOKIE, Lang, MESSAGES } from "@/lib/i18n";

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const Ctx = createContext<I18nCtx | null>(null);

function setCookieLang(lang: Lang) {
  // 1 year
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LANG_COOKIE}=${encodeURIComponent(lang)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function I18nProvider({
  initialLang,
  children,
}: {
  initialLang?: string | null;
  children: React.ReactNode;
}) {
  const initial: Lang = isLang(initialLang) ? initialLang : DEFAULT_LANG;
  const [lang, _setLang] = useState<Lang>(initial);

  const setLang = (l: Lang) => {
    _setLang(l);
    try {
      localStorage.setItem(LANG_COOKIE, l);
    } catch {
      // ignore
    }
    setCookieLang(l);
  };

  const t = useMemo(() => {
    return (key: string) => {
      const fromLang = MESSAGES[lang]?.[key];
      if (fromLang) return fromLang;
      const fromRu = MESSAGES.ru?.[key];
      return fromRu ?? key;
    };
  }, [lang]);

  const value = useMemo<I18nCtx>(() => ({ lang, setLang, t }), [lang, t]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
