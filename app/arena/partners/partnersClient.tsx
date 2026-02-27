"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Users, PlayCircle, Handshake, Send, Globe, Youtube, Trash2, ImagePlus } from "lucide-react";
import { cn } from "@/components/utils/cn";
import { kickIframeSrc } from "@/lib/streamers";

type MeUser =
  | {
      id: string;
      email: string;
      nickname: string | null;
      isAdmin?: boolean;
    }
  | null;

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
  _source?: "static" | "db";
  _type?: "streamer" | "partner";
};

function SocialLink({ href, label }: { href?: string; label: string }) {
  if (!href) return null;
  const Icon =
    label === "telegram" ? Send :
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

function normSlug(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function PartnersClient() {
  const [me, setMe] = useState<MeUser>(null);

  const [streamers, setStreamers] = useState<Item[]>([]);
  const [partners, setPartners] = useState<Item[]>([]);
  const [watch, setWatch] = useState<Item | null>(null);

  const [tab, setTab] = useState<"streamers" | "become">("streamers");

  // Admin form
  const isAdmin = Boolean(me && (me as any).isAdmin);
  const [aType, setAType] = useState<"streamer" | "partner">("streamer");
  const [aName, setAName] = useState("ZAVA");
  const [aTitle, setATitle] = useState('Стример ZAVA');
  const [aSlug, setASlug] = useState("zava");
  const [aTagline, setATagline] = useState("CS2 • 1v1 • турниры • кланы");
  const [aPhoto, setAPhoto] = useState<string>("/banners/zava-avatar.png");
  const [aKickChannel, setAKickChannel] = useState("zavaditch");
  const [aKickEmbedUrl, setAKickEmbedUrl] = useState("");
  const [sTelegram, setSTelegram] = useState("https://t.me/zavaditch");
  const [sKick, setSKick] = useState("https://kick.com/zavaditch");
  const [sYoutube, setSYoutube] = useState("");
  const [sWebsite, setSWebsite] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const r = await fetch("/api/arena/streamers", { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!r || !r.ok) return;
    const j = await r.json().catch(() => null);
    if (!j?.ok) return;
    setStreamers(j.streamers || []);
    setPartners(j.partners || []);
  }

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        setMe(j?.user ?? null);
      } catch {
        setMe(null);
      }
    })();
    refresh();
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

  async function uploadPhoto(file: File) {
    const form = new FormData();
    form.append("file", file);
    const r = await fetch("/api/arena/uploads/image", {
      method: "POST",
      body: form,
      credentials: "include",
    }).catch(() => null);
    if (!r || !r.ok) throw new Error("UPLOAD_FAILED");
    const j = await r.json().catch(() => ({}));
    if (!j?.ok || !j?.url) throw new Error("UPLOAD_FAILED");
    return String(j.url);
  }

  async function adminSave() {
    if (!isAdmin) return;
    const slug = normSlug(aSlug || aName);
    if (!slug || !aName.trim() || !aTitle.trim() || !aPhoto.trim()) {
      alert("Заполни slug/name/title/photo");
      return;
    }

    setBusy(true);
    try {
      const socials: any = {};
      if (sTelegram.trim()) socials.telegram = sTelegram.trim();
      if (sKick.trim()) socials.kick = sKick.trim();
      if (sYoutube.trim()) socials.youtube = sYoutube.trim();
      if (sWebsite.trim()) socials.website = sWebsite.trim();

      const r = await fetch("/api/arena/streamers/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: aType,
          slug,
          name: aName.trim(),
          title: aTitle.trim(),
          photo: aPhoto.trim(),
          tagline: aTagline.trim(),
          kickChannel: aKickChannel.trim(),
          kickEmbedUrl: aKickEmbedUrl.trim(),
          socials,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "FAILED");
      await refresh();
      alert("Сохранено");
    } catch (e: any) {
      alert(e?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function adminDelete(slug: string) {
    if (!isAdmin) return;
    if (!confirm(`Удалить "${slug}"?`)) return;
    const r = await fetch(`/api/arena/streamers/admin?slug=${encodeURIComponent(slug)}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    if (!r || !r.ok || !j?.ok) {
      alert("Не удалось удалить");
      return;
    }
    await refresh();
  }

  const sections = useMemo(() => {
    return [
      { key: "streamers", title: "Стримеры", icon: <PlayCircle className="h-4 w-4" />, items: streamers },
      { key: "partners", title: "Партнеры", icon: <Handshake className="h-4 w-4" />, items: partners },
    ] as const;
  }, [streamers, partners]);

  return (
    <div className="space-y-6">
      {/* Header + tabs (как сейчас) */}
      <div>
        <div className="text-white/50 text-xs font-semibold tracking-[0.18em] uppercase">Community</div>
        <h1 className="mt-2 text-3xl font-extrabold text-white">Стримеры и партнёры</h1>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setTab("streamers")}
            className={cn(
              "h-10 px-4 rounded-2xl border text-sm font-extrabold transition inline-flex items-center gap-2",
              tab === "streamers"
                ? "bg-white/10 border-white/15 text-white"
                : "bg-white/5 border-white/10 text-white/80 hover:bg-white/8"
            )}
          >
            <PlayCircle className={cn("h-4 w-4", tab === "streamers" ? "text-accent" : "text-white/70")} />
            Стримеры и партнёры
          </button>

          <button
            onClick={() => setTab("become")}
            className={cn(
              "h-10 px-4 rounded-2xl border text-sm font-extrabold transition inline-flex items-center gap-2",
              tab === "become"
                ? "bg-white/10 border-white/15 text-white"
                : "bg-white/5 border-white/10 text-white/80 hover:bg-white/8"
            )}
          >
            <Handshake className={cn("h-4 w-4", tab === "become" ? "text-accent" : "text-white/70")} />
            Стать партнёром
          </button>
        </div>
      </div>

      {/* TAB: STREAMERS */}
      {tab === "streamers" ? (
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-black/25 backdrop-blur-xl p-5 md:p-6">
            <p className="text-white/80 text-lg font-semibold">
              Смотри трансляции прямо на арене Beav и вступай в команды стримеров.
            </p>
          </div>

          {/* Admin add streamer (only admin) */}
          {isAdmin ? (
            <div className="rounded-3xl border border-white/10 bg-black/25 backdrop-blur-xl p-5 md:p-6">
              <div className="text-white/80 text-xs font-extrabold tracking-[0.18em] uppercase">Admin</div>
              <div className="mt-3 grid lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2 grid gap-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <select
                      value={aType}
                      onChange={(e) => setAType(e.target.value as any)}
                      className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 outline-none focus:border-white/20"
                    >
                      <option value="streamer">streamer</option>
                      <option value="partner">partner</option>
                    </select>

                    <input
                      value={aSlug}
                      onChange={(e) => setASlug(e.target.value)}
                      placeholder="slug (например zava)"
                      className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <input
                      value={aName}
                      onChange={(e) => setAName(e.target.value)}
                      placeholder="name (badge) например ZAVA"
                      className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
                    />
                    <input
                      value={aTitle}
                      onChange={(e) => setATitle(e.target.value)}
                      placeholder="title на карточке"
                      className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
                    />
                  </div>

                  <input
                    value={aTagline}
                    onChange={(e) => setATagline(e.target.value)}
                    placeholder="tagline"
                    className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
                  />

                  <div className="grid sm:grid-cols-2 gap-3">
                    <input
                      value={aKickChannel}
                      onChange={(e) => setAKickChannel(e.target.value)}
                      placeholder="kickChannel (например zavaditch)"
                      className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
                    />
                    <input
                      value={aKickEmbedUrl}
                      onChange={(e) => setAKickEmbedUrl(e.target.value)}
                      placeholder="kickEmbedUrl (если нужен)"
                      className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <input
                      value={sTelegram}
                      onChange={(e) => setSTelegram(e.target.value)}
                      placeholder="telegram url"
                      className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
                    />
                    <input
                      value={sKick}
                      onChange={(e) => setSKick(e.target.value)}
                      placeholder="kick url"
                      className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <input
                      value={sYoutube}
                      onChange={(e) => setSYoutube(e.target.value)}
                      placeholder="youtube url"
                      className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
                    />
                    <input
                      value={sWebsite}
                      onChange={(e) => setSWebsite(e.target.value)}
                      placeholder="website url"
                      className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
                    />
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="text-white/60 text-xs font-extrabold tracking-[0.18em] uppercase">Фото</div>

                    <input
                      value={aPhoto}
                      onChange={(e) => setAPhoto(e.target.value)}
                      placeholder="photo url/path"
                      className="mt-2 h-11 w-full rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
                    />

                    <label className="mt-2 inline-flex items-center gap-2 h-10 px-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/8 text-white/85 text-xs font-extrabold cursor-pointer">
                      <ImagePlus className="h-4 w-4" />
                      Загрузить
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            setBusy(true);
                            const url = await uploadPhoto(f);
                            setAPhoto(url);
                          } catch {
                            alert("Не удалось загрузить");
                          } finally {
                            setBusy(false);
                            e.currentTarget.value = "";
                          }
                        }}
                      />
                    </label>

                    {aPhoto ? (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                        <img src={aPhoto} alt="" className="w-full h-auto block object-cover" />
                      </div>
                    ) : null}
                  </div>

                  <button
                    onClick={adminSave}
                    disabled={busy}
                    className={cn(
                      "h-11 rounded-2xl font-extrabold text-black",
                      busy ? "bg-white/20 cursor-not-allowed" : "bg-accent hover:bg-accent/90"
                    )}
                  >
                    {busy ? "…" : "Сохранить стримера"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Cards sections */}
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
                      <img src={s.photo} alt={s.title} className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4">
                        <div className="text-white font-extrabold text-lg leading-tight">{s.title}</div>
                        <div className="text-white/70 text-xs">{s.tagline || "—"}</div>
                      </div>

                      {isAdmin && s._source === "db" ? (
                        <button
                          onClick={() => adminDelete(s.slug)}
                          className="absolute top-3 right-3 h-10 w-10 rounded-2xl border border-white/10 bg-black/40 hover:bg-black/55 grid place-items-center"
                          title="Удалить (DB)"
                        >
                          <Trash2 className="h-4 w-4 text-white/75" />
                        </button>
                      ) : null}
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
                    <div
                      className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black/30"
                      style={{ paddingTop: "56.25%" }}
                    >
                      <iframe
                        src={kickIframeSrc(watch as any) as string}
                        className="absolute inset-0 w-full h-full"
                        allow="autoplay; fullscreen"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70 text-sm">
                      Для этого стримера не задан Kick (kickChannel/kickEmbedUrl).
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* TAB: BECOME PARTNER (оставляем как сейчас — минимально) */}
      {tab === "become" ? (
        <div className="rounded-3xl border border-white/10 bg-black/25 backdrop-blur-xl p-5 md:p-6">
          <p className="text-white/85 text-lg font-semibold">
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

          <div className="mt-6 grid gap-3">
            <div className="text-white/55 text-xs font-semibold tracking-[0.18em] uppercase">
              Шаблон полей (для удобства)
            </div>
            <input
              placeholder="Ссылка на Kick"
              className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
            />
            <input
              placeholder="Ссылка на Twitch"
              className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
            />
            <textarea
              placeholder="Описание / интеграции"
              rows={4}
              className="rounded-2xl bg-black/25 border border-white/10 px-3 py-2 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20 resize-none"
            />
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-white/55 text-sm">
              Логотип / Фото — приложите в сообщении @dendemi
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}