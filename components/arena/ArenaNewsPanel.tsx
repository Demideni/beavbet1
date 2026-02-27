"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { cn } from "@/components/utils/cn";

type MeUser =
  | {
      id: string;
      email: string;
      nickname: string | null;
      isAdmin?: boolean;
    }
  | null;

type NewsItem = {
  id: string;
  title: string;
  text: string;
  imageUrl: string | null;
  createdAt: number;
  adminNick: string | null;
  adminAvatarUrl: string | null;
};

function fmt(ts: number) {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "";
  }
}

export default function ArenaNewsPanel({ className }: { className?: string }) {
  const [me, setMe] = useState<MeUser>(null);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin form state
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = Boolean(me && (me as any).isAdmin);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/arena/news?limit=12", { cache: "no-store", credentials: "include" });
      const j = await r.json().catch(() => ({}));
      if (j?.ok) setItems(Array.isArray(j.items) ? j.items : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
        const j = await r.json().catch(() => ({}));
        setMe(j?.user ?? null);
      } catch {
        setMe(null);
      }
    })();
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canPost = useMemo(() => {
    if (!isAdmin) return false;
    return title.trim().length > 0 && text.trim().length > 0 && !busy;
  }, [isAdmin, title, text, busy]);

  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    const r = await fetch("/api/arena/uploads/image", {
      method: "POST",
      body: form,
      credentials: "include",
    }).catch(() => null);
    if (!r || !r.ok) throw new Error("UPLOAD_FAILED");
    const j = await r.json().catch(() => null);
    if (!j?.ok || !j?.url) throw new Error("UPLOAD_FAILED");
    return String(j.url);
  }

  async function publish() {
    if (!canPost) return;
    setBusy(true);
    try {
      const r = await fetch("/api/arena/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), text: text.trim(), imageUrl }),
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "FAILED");
      setTitle("");
      setText("");
      setImageUrl(null);
      await refresh();
    } catch (e: any) {
      alert(e?.message || "Не удалось опубликовать");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!isAdmin) return;
    if (!confirm("Удалить новость?")) return;
    const r = await fetch(`/api/arena/news?id=${encodeURIComponent(id)}`, {
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

  return (
    <div className={cn("rounded-3xl border border-white/10 bg-black/30 p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-white font-extrabold text-lg">Новости арены</div>
          <div className="text-white/60 text-sm mt-1">Обновления и анонсы от администрации</div>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="h-9 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/8 text-white/85 text-xs font-extrabold"
        >
          Обновить
        </button>
      </div>

      {/* Admin-only form */}
      {isAdmin ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="text-white/80 text-xs font-extrabold tracking-[0.18em] uppercase">Admin</div>

          <div className="mt-2 grid gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Заголовок"
              className="h-11 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Текст новости"
              rows={4}
              className="rounded-2xl bg-black/25 border border-white/10 px-3 py-2 text-white/90 placeholder:text-white/35 outline-none focus:border-white/20 resize-none"
            />

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 h-10 px-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/8 text-white/85 text-xs font-extrabold cursor-pointer">
                <ImagePlus className="h-4 w-4" />
                Фото
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      setBusy(true);
                      const url = await upload(f);
                      setImageUrl(url);
                    } catch {
                      alert("Не удалось загрузить фото");
                    } finally {
                      setBusy(false);
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </label>

              {imageUrl ? (
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="h-10 px-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/8 text-white/75 text-xs font-extrabold"
                >
                  Убрать фото
                </button>
              ) : null}

              <button
                type="button"
                onClick={publish}
                disabled={!canPost}
                className={cn(
                  "h-10 px-4 rounded-2xl font-extrabold text-black",
                  canPost ? "bg-accent hover:bg-accent/90" : "bg-white/20 cursor-not-allowed"
                )}
              >
                {busy ? "…" : "Опубликовать"}
              </button>
            </div>

            {imageUrl ? (
              <div
                className="mt-2 relative overflow-hidden rounded-2xl border border-white/10 bg-black/40"
                style={{ paddingTop: "56.25%" }}
              >
                <Image src={imageUrl} alt="" fill className="object-cover" />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {loading ? (
          <div className="text-white/60">Загрузка…</div>
        ) : items.length === 0 ? (
          <div className="text-white/60">Пока нет новостей</div>
        ) : (
          items.map((n) => (
            <div key={n.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              {n.imageUrl ? (
                <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                  <Image src={n.imageUrl} alt="" fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                </div>
              ) : null}

              <div className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white font-extrabold truncate">{n.title}</div>
                    <div className="text-white/45 text-xs mt-1">{fmt(n.createdAt)}</div>
                  </div>

                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => remove(n.id)}
                      className="shrink-0 h-9 w-9 grid place-items-center rounded-2xl border border-white/10 bg-white/5 hover:bg-white/8"
                      aria-label="Delete"
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4 text-white/75" />
                    </button>
                  ) : null}
                </div>

                <div className="text-white/75 text-sm mt-2 whitespace-pre-line">{n.text}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}