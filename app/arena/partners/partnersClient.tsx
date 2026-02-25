"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ExternalLink, Users, PlayCircle, Handshake, Telegram, Globe, Youtube } from "lucide-react";
import { cn } from "@/components/utils/cn";
import { kickIframeSrc } from "@/lib/streamers";

type Item = {
  slug: string;
  name: string;
  title: string;
  photo: string;
  socials: Record<string, string | undefined>;
  kickChannel?: string;
  kickEmbedUrl?: string;
  tagline?: string;
  teamCount: number;
  joined: boolean;
};

function SocialLink({ href, label }: { href?: string; label: string }) {
  if (!href) return null;
  const Icon =
    label === "telegram" ? Telegram :
    label === "website" ? Globe :
    label === "youtube" ? Youtube :
    ExternalLink;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85"
    >
      <Icon className="h-4 w-4 text-white/70" />
      <span className="capitalize">{label}</span>
    </a>
  );
}

export default function PartnersClient() {
  const [streamers, setStreamers] = useState<Item[]>([]);
  const [partners, setPartners] = useState<Item[]>([]);
  const [watch, setWatch] = useState<Item | null>(null);
  const [promo, setPromo] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/arena/streamers", { credentials: "include" }).catch(() => null);
      if (!r || !r.ok) return;
      const j = await r.json().catch(() => null);
      if (!j?.ok) return;
      setStreamers(j.streamers || []);
      setPartners(j.partners || []);
    })();
  }, []);

  async function join(slug: string) {
    const r = await fetch("/api/arena/streamers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      credentials: "include",
    }).catch(() => null);
    if (!r || !r.ok) return;
    const j = await r.json().catch(() => null);
    if (!j?.ok) return;
    const apply = (arr: Item[]) =>
      arr.map((x) => (x.slug === slug ? { ...x, joined: true, teamCount: j.teamCount ?? x.teamCount } : x));
    setStreamers((p) => apply(p));
    setPartners((p) => apply(p));
  }

  async function leave(slug: string) {
    const r = await fetch(`/api/arena/streamers?slug=${encodeURIComponent(slug)}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => null);
    if (!r || !r.ok) return;
    const j = await r.json().catch(() => null);
    if (!j?.ok) return;
    const apply = (arr: Item[]) =>
      arr.map((x) => (x.slug === slug ? { ...x, joined: false, teamCount: j.teamCount ?? x.teamCount } : x));
    setStreamers((p) => apply(p));
    setPartners((p) => apply(p));
  }

  const sections = useMemo(() => {
    return [
      { key: "streamers", title: "Стримеры", icon: <PlayCircle className="h-4 w-4" />, items: streamers },
      { key: "partners", title: "Партнеры", icon: <Handshake className="h-4 w-4" />, items: partners },
    ] as const;
  }, [streamers, partners]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-white/50 text-xs font-semibold tracking-[0.18em] uppercase">Community</div>
          <h1 className="mt-2 text-3xl font-extrabold text-white">Стримеры и партнеры</h1>
          <p className="mt-2 text-white/70 max-w-[70ch]">
            Смотри трансляции прямо на BeavBet Arena, вступай в команды стримеров и получай оранжевую метку
            <span className="text-accent font-extrabold"> [имя стримера]</span> после ника.
          </p>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <div className="text-white/55 text-xs">Контакт для партнёрства:</div>
          <a
            className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-extrabold text-white"
            href="https://t.me/dendemi"
            target="_blank"
            rel="noreferrer"
          >
            @dendemi
          </a>
        </div>
      </div>

      {/* Become a partner */}
      <div className="rounded-3xl border border-white/10 bg-black/25 backdrop-blur-xl p-5 md:p-6">
        <div className="flex items-center gap-2 text-white font-extrabold">
          <Handshake className="h-5 w-5 text-accent" />
          <div>Стать партнёром</div>
        </div>
        <div className="mt-2 text-white/70 text-sm">
          Хотите карточку в арене, промо в туриках, брендированные комнаты и интеграции? Напишите в Telegram:
          <a className="ml-2 text-accent font-extrabold hover:underline" href="https://t.me/dendemi" target="_blank" rel="noreferrer">
            @dendemi
          </a>
          .
        </div>
        <div className="mt-4 grid md:grid-cols-3 gap-3">
          <input
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            placeholder="Для стримеров: ссылка на Kick (channel или embed URL)"
            className="md:col-span-2 h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
          />
          <div className="h-11 rounded-2xl border border-white/10 bg-white/5 grid place-items-center text-white/55 text-xs">
            (шаблон поля — для удобства)
          </div>
        </div>
        <div className="mt-3 text-xs text-white/45">
          Где вставлять ссылку на Kick, чтобы стрим отображался на арене: файл <span className="text-white/70 font-semibold">lib/streamers.ts</span>,
          поле <span className="text-white/70 font-semibold">kickChannel</span> или <span className="text-white/70 font-semibold">kickEmbedUrl</span>.
        </div>
      </div>

      {sections.map((sec) => (
        <div key={sec.key} className="space-y-3">
          <div className="flex items-center gap-2 text-white/85 font-extrabold">
            {sec.icon}
            <div>{sec.title}</div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sec.items.map((s) => (
              <div key={s.slug} className="rounded-3xl border border-white/10 bg-black/25 backdrop-blur-xl overflow-hidden">
                <div className="relative h-[160px]">
                  <Image src={s.photo} alt={s.title} fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <div className="text-white font-extrabold text-lg leading-tight">{s.title}</div>
                    <div className="text-white/70 text-xs">{s.tagline || "—"}</div>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-white/80 text-sm">
                      <Users className="h-4 w-4 text-white/50" />
                      <span>
                        Команда: <span className="text-white font-extrabold">{s.teamCount}</span>
                      </span>
                    </div>

                    <button
                      className={cn(
                        "h-9 px-4 rounded-2xl text-xs font-extrabold border transition-colors",
                        s.joined
                          ? "bg-white/5 border-white/15 text-white/80 hover:bg-white/8"
                          : "bg-accent text-black border-black/10 hover:brightness-110"
                      )}
                      onClick={() => (s.joined ? leave(s.slug) : join(s.slug))}
                      title={s.joined ? "Выйти из команды" : "Присоединиться"}
                    >
                      {s.joined ? "В команде" : "Вступить"}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <SocialLink href={s.socials?.telegram} label="telegram" />
                    <SocialLink href={s.socials?.kick} label="kick" />
                    <SocialLink href={s.socials?.youtube} label="youtube" />
                    <SocialLink href={s.socials?.website} label="website" />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-extrabold text-white/85"
                      onClick={() => setWatch(s)}
                    >
                      <PlayCircle className="h-4 w-4 text-accent" />
                      Смотреть на арене
                    </button>

                    {s.socials?.kick ? (
                      <a
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-extrabold text-white/85"
                        href={s.socials.kick}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 text-white/60" />
                        Kick
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Watch modal */}
      {watch ? (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-[980px] rounded-3xl border border-white/10 bg-black/35 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/15">
              <div className="text-white font-extrabold">{watch.title}</div>
              <button
                className="h-9 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/85 font-extrabold text-xs"
                onClick={() => setWatch(null)}
              >
                Закрыть
              </button>
            </div>

            <div className="p-4">
              {kickIframeSrc(watch as any) ? (
                <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black/30" style={{ paddingTop: "56.25%" }}>
                  <iframe
                    src={kickIframeSrc(watch as any) as string}
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay; fullscreen"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70 text-sm">
                  Для этого стримера не задан Kick. Вставь ссылку в <span className="text-white font-semibold">lib/streamers.ts</span>.
                </div>
              )}

              <div className="mt-3 text-xs text-white/45">
                Примечание: для отображения стрима используем iframe Kick player. Если Kick меняет правила, можно заменить на embed URL.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
