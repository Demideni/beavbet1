"use client";

import { useMemo, useState } from "react";
import { Handshake, PlayCircle, Send } from "lucide-react";
import { cn } from "@/components/utils/cn";

export default function PartnersClient() {
  const tabs = useMemo(
    () => [
      { key: "streamers", label: "Стримеры и партнёры", icon: <PlayCircle className="h-4 w-4" /> },
      { key: "partner", label: "Стать партнёром", icon: <Handshake className="h-4 w-4" /> },
    ],
    []
  );

  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("streamers");
  const [kick, setKick] = useState("");
  const [twitch, setTwitch] = useState("");
  const [about, setAbout] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <div className="text-white/50 text-xs font-semibold tracking-[0.18em] uppercase">Community</div>
        <h1 className="mt-2 text-3xl font-extrabold text-white">Стримеры и партнёры</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setTab(x.key)}
            className={cn(
              "inline-flex items-center gap-2 h-10 px-4 rounded-2xl border text-sm font-extrabold transition",
              tab === x.key
                ? "bg-white/10 border-white/15 text-white"
                : "bg-white/5 border-white/10 text-white/80 hover:bg-white/8"
            )}
          >
            <span className={cn(tab === x.key ? "text-accent" : "text-white/70")}>{x.icon}</span>
            {x.label}
          </button>
        ))}
      </div>

      {tab === "streamers" ? (
        <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
          <p className="text-white/80 text-lg font-semibold">
            Смотри трансляции прямо на арене Beav и вступай в команды стримеров.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
          <div className="flex items-center gap-2 text-white font-extrabold">
            <Handshake className="h-5 w-5 text-accent" />
            <div>Стать партнёром</div>
          </div>

          <p className="mt-2 text-white/75">
            Хотите карточку в арене, собственный турнир, брендированную комнату интеграции? Напишите нам @dendemi
          </p>

          <a
            href="https://t.me/dendemi"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 h-11 px-5 rounded-2xl bg-accent text-black font-extrabold hover:bg-accent/90"
          >
            <Send className="h-4 w-4" />
            Напишите нам
          </a>

          {/* Шаблонные поля (только для удобства) */}
          <div className="mt-6 grid gap-3">
            <div className="text-white/55 text-xs font-semibold tracking-[0.18em] uppercase">
              Шаблон полей (для удобства)
            </div>

            <input
              value={kick}
              onChange={(e) => setKick(e.target.value)}
              placeholder="Ссылка на Kick"
              className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
            />

            <input
              value={twitch}
              onChange={(e) => setTwitch(e.target.value)}
              placeholder="Ссылка на Twitch"
              className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
            />

            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Описание / интеграции"
              rows={4}
              className="rounded-2xl bg-black/25 border border-white/10 px-3 py-2 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20 resize-none"
            />

            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-white/55 text-sm">
              Логотип / Фото — приложите в сообщении @dendemi
            </div>
          </div>
        </div>
      )}
    </div>
  );
}