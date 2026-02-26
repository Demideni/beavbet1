"use client";

import { Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/utils/cn";
import { Lang, SUPPORTED_LANGS } from "@/lib/i18n";
import { useI18n } from "./I18nProvider";

const FLAGS: Record<Lang, string> = {
  ru: "🇷🇺",
  en: "🇺🇸",
  es: "🇪🇸",
};

const NAMES: Record<Lang, string> = {
  ru: "Русский",
  en: "English",
  es: "Español",
};

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center justify-center",
          compact ? "size-10" : "h-10 px-3",
          "rounded-xl bg-white/6 border border-white/10 hover:bg-white/8",
          "text-white/85"
        )}
        aria-label="Language"
      >
        {compact ? (
          <span className="text-lg leading-none">{FLAGS[lang]}</span>
        ) : (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-lg leading-none">{FLAGS[lang]}</span>
            <span className="hidden sm:inline">{NAMES[lang]}</span>
            <Globe className="size-4 opacity-80" />
          </span>
        )}
      </button>

      {open ? (
        <div
          className={cn(
            "absolute right-0 mt-2 w-52 rounded-2xl",
            "bg-bg/95 backdrop-blur-md border border-white/10 shadow-soft",
            "p-1"
          )}
        >
          {SUPPORTED_LANGS.map((l) => (
            <button
              key={l}
              className={cn(
                "w-full flex items-center justify-between gap-3",
                "px-3 py-2 rounded-xl",
                "hover:bg-white/7",
                l === lang ? "bg-white/8" : "bg-transparent",
                "text-left"
              )}
              onClick={() => {
                setLang(l);
                setOpen(false);
              }}
            >
              <span className="flex items-center gap-2 text-white/90">
                <span className="text-lg leading-none">{FLAGS[l]}</span>
                <span className="text-sm">{NAMES[l]}</span>
              </span>
              <span className="text-xs text-white/45">{l.toUpperCase()}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
