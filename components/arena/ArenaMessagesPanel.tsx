"use client";

import { useEffect, useMemo, useState } from "react";
import DmModal from "@/components/arena/DmModal";
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
  const [openWith, setOpenWith] = useState<{ id: string; nick?: string | null } | null>(null);

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
      <div className="text-white/60 text-sm mt-1">Личные переписки с игроками.</div>

      <div className="mt-4">
        {loading ? (
          <div className="text-white/60">Loading…</div>
        ) : empty ? (
          <div className="text-white/45">No messages yet. Открой дуэль и нажми “Message”.</div>
        ) : (
          <div className="space-y-2">
            {threads.map((t) => (
              <button
                key={t.threadId}
                onClick={() => setOpenWith({ id: t.otherUserId, nick: t.otherNick })}
                className={cn(
                  "w-full text-left rounded-3xl bg-white/6 border border-white/10 px-4 py-3 hover:bg-white/10"
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
                  <div className="text-white/45 text-xs">{new Date(Number(t.updatedAt)).toLocaleString()}</div>
                </div>
                <div className="text-white/65 text-sm mt-1 truncate">{t.lastMessage || ""}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <DmModal
        open={Boolean(openWith)}
        onClose={() => {
          setOpenWith(null);
          load();
        }}
        withUserId={openWith?.id || ""}
        withNick={openWith?.nick}
      />
    </div>
  );
}
