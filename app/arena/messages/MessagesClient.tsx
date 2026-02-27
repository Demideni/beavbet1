"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Dialog = {
  id: string;
  title: string;          // имя собеседника или название диалога
  lastText?: string | null;
  updatedAt?: string | null;  // ISO
  avatarUrl?: string | null;
  unreadCount?: number | null;
};

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

function fmtTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Avatar({ url, name }: { url?: string | null; name: string }) {
  const letter = (name?.trim()?.[0] || "?").toUpperCase();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="h-11 w-11 rounded-full object-cover" />;
  }
  return (
    <div className="h-11 w-11 rounded-full bg-white/10 flex items-center justify-center font-semibold">
      {letter}
    </div>
  );
}

export default function MessagesClient() {
  const router = useRouter();
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        // ⚠️ ВАЖНО: эндпоинт должен отдавать { dialogs: Dialog[] }
        const res = await fetch("/api/arena/messages/dialogs", { cache: "no-store" });
        if (!res.ok) throw new Error("dialogs fetch failed");
        const data = (await res.json()) as { dialogs: Dialog[] };

        if (!alive) return;
        setDialogs(Array.isArray(data?.dialogs) ? data.dialogs : []);
      } catch {
        if (!alive) return;
        setDialogs([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = norm(q);
    if (!s) return dialogs;
    return dialogs.filter((d) => norm(d.title).includes(s) || norm(d.lastText || "").includes(s));
  }, [dialogs, q]);

  return (
    <div className="relative min-h-[calc(100vh-24px)]">
      {/* ✅ ФОН КАК В АРЕНЕ */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#070A0F]" />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-red-600/20 blur-[120px]" />
        <div className="absolute inset-0 bg-black/35" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-4 md:py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Сообщения</h1>
            <p className="text-sm text-white/60">
              {loading ? "Загрузка…" : `${dialogs.length} диалогов`}
            </p>
          </div>

          <div className="w-[240px] md:w-[360px]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск"
              className="w-full rounded-xl bg-black/35 border border-white/10 px-3 py-2 text-sm outline-none focus:border-orange-500/60"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-white/60">
              {q ? "Ничего не найдено." : "Диалогов пока нет."}
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filtered.map((d) => {
                const time = fmtTime(d.updatedAt);
                const unread = Math.max(0, Number(d.unreadCount || 0));
                return (
                  <button
                    key={d.id}
                    onClick={() => router.push(`/arena/messages/${d.id}`)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center gap-3"
                  >
                    <Avatar url={d.avatarUrl} name={d.title} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold truncate">{d.title}</div>
                        <div className="ml-auto text-xs text-white/45">{time}</div>
                      </div>
                      <div className="text-sm text-white/60 truncate">
                        {d.lastText || " "}
                      </div>
                    </div>

                    {unread > 0 ? (
                      <div className="ml-2 min-w-[22px] h-[22px] px-2 rounded-full bg-orange-500 text-black text-xs font-bold flex items-center justify-center">
                        {unread}
                      </div>
                    ) : (
                      <div className="text-white/35 text-lg leading-none">›</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="h-6 md:h-10" />
      </div>
    </div>
  );
}