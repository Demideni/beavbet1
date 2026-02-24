"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/components/utils/cn";

type Msg = {
  id: string;
  threadId: string;
  senderId: string;
  senderNick?: string | null;
  message: string;
  createdAt: number;
};

export default function DmInline({
  withUserId,
  withNick,
  className,
}: {
  withUserId: string;
  withNick?: string | null;
  className?: string;
}) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [meId, setMeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const title = useMemo(() => withNick || "Direct message", [withNick]);

  async function ensureThread() {
    const r = await fetch("/api/arena/dm/thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ withUserId }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || "Failed");
    return String(j.threadId);
  }

  async function loadMe() {
    const r = await fetch("/api/auth/me", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setMeId(j?.user?.id ?? null);
  }

  async function loadMessages(tid: string) {
    const r = await fetch(`/api/arena/dm/messages?threadId=${encodeURIComponent(tid)}&limit=120`, {
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({} as any));
    const arr = Array.isArray((j as any)?.messages)
      ? ((j as any).messages as Msg[])
      : Array.isArray(j)
        ? (j as Msg[])
        : [];
    setMessages(arr);
  }

  function connectSse(tid: string) {
    try {
      esRef.current?.close();
    } catch {}
    const es = new EventSource(`/api/arena/dm/stream?threadId=${encodeURIComponent(tid)}`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.type === "message" && data?.msg) {
          const m = data.msg;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [
              ...prev,
              {
                id: m.id,
                threadId: m.thread_id,
                senderId: m.sender_id,
                senderNick: m.sender_nick ?? null,
                message: m.message,
                createdAt: m.created_at,
              } as any,
            ];
          });
        }
      } catch {}
    };
    es.onerror = () => {
      // browser will retry
    };
    esRef.current = es;
  }

  useEffect(() => {
    if (!withUserId) return;
    let cancelled = false;
    (async () => {
      try {
        await loadMe();
        const tid = await ensureThread();
        if (cancelled) return;
        setThreadId(tid);
        await loadMessages(tid);
        if (cancelled) return;
        connectSse(tid);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
      try {
        esRef.current?.close();
      } catch {}
      esRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!threadId) return;
    const msg = text.trim();
    if (!msg) return;
    setBusy(true);
    setText("");
    const r = await fetch("/api/arena/dm/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, message: msg }),
    });
    setBusy(false);
    if (!r.ok) setText(msg);
  }

  return (
    <div className={cn("h-full flex flex-col rounded-3xl border border-white/10 bg-black/25 overflow-hidden", className)}>
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="text-white font-extrabold truncate">{title}</div>
        <div className="text-white/40 text-xs">DM</div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-white/45 text-sm">Напиши первое сообщение.</div>
        ) : null}
        {messages.map((m) => {
          const mine = meId && m.senderId === meId;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[86%] rounded-2xl px-3 py-2 text-sm border",
                  mine ? "bg-accent/20 border-accent/30 text-white" : "bg-white/6 border-white/10 text-white/90"
                )}
              >
                {!mine ? (
                  <div className="text-[11px] text-accent font-semibold mb-1">{m.senderNick || ""}</div>
                ) : null}
                <div className="whitespace-pre-wrap break-words">{m.message}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Write a message…"
            className="flex-1 h-11 rounded-2xl bg-white/6 border border-white/10 px-3 text-white placeholder:text-white/40 outline-none"
          />
          <button
            onClick={send}
            disabled={busy}
            className="h-11 px-4 rounded-2xl bg-accent text-black font-bold hover:opacity-95 disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
