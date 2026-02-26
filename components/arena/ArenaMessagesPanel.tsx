"use client";

import { useEffect, useMemo, useState } from "react";
import DmInline from "@/components/arena/DmInline";
import { cn } from "@/components/utils/cn";

type ThreadRow = {
  threadId: string;
  otherUserId: string;
  otherNick?: string | null;
  otherAvatar?: string | null;
  updatedAt: number;
  lastMessage?: string | null;
  unreadCount?: number;
};

export default function ArenaMessagesPanel() {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ id: string; nick?: string | null } | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/arena/dm/threads", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setThreads(j?.threads ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const empty = useMemo(() => !loading && threads.length === 0, [loading, threads.length]);

  return (
    <div className="rounded-3xl card-glass p-6">
      <div className="text-white text-xl font-extrabold">Messages</div>
      <div className="text-white/60 text-sm mt-1">Inbox как Faceit/Discord: слева треды, справа чат.</div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 min-h-[520px]">
        {/* Threads */}
        <div className="rounded-3xl border border-white/10 bg-black/25 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <div className="text-white/80 text-xs font-semibold tracking-[0.18em] uppercase">Inbox</div>
          </div>

          <div className="max-h-[520px] lg:max-h-none overflow-y-auto">
            {loading ? (
              <div className="px-4 py-4 text-white/60">Loading…</div>
            ) : empty ? (
              <div className="px-4 py-20 text-center text-white/45">
                У вас пока нет диалогов.
                <div className="mt-2 text-white/35 text-sm">Открой дуэль и нажми “Message”.</div>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {threads.map((t) => {
                  const active = selected?.id === t.otherUserId;
                  return (
                    <button
                      key={t.threadId}
                      onClick={() => setSelected({ id: t.otherUserId, nick: t.otherNick })}
                      className={cn(
                        "w-full text-left rounded-2xl px-3 py-3 border transition",
                        active
                          ? "bg-white/10 border-white/16"
                          : "bg-white/5 border-white/10 hover:bg-white/8"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-white font-extrabold truncate">{t.otherNick || t.otherUserId.slice(0, 6)}</div>
                          {Number(t.unreadCount || 0) > 0 ? (
                            <span className="shrink-0 h-5 min-w-5 px-1 rounded-full bg-accent text-black text-xs font-extrabold flex items-center justify-center">
                              {t.unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-white/35 text-[11px]">{new Date(Number(t.updatedAt)).toLocaleTimeString()}</div>
                      </div>
                      <div className="text-white/60 text-sm mt-1 truncate">{t.lastMessage || ""}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chat */}
        {selected ? (
          <DmInline withUserId={selected.id} withNick={selected.nick} className="min-h-[520px]" />
        ) : (
          <div className="rounded-3xl border border-white/10 bg-black/25 grid place-items-center min-h-[520px]">
            <div className="text-center">
              <div className="text-white/70 font-semibold">Выбери диалог</div>
              <div className="text-white/40 text-sm mt-1">Или начни переписку из дуэли.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
