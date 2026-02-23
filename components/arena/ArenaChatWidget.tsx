"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { cn } from "@/components/utils/cn";

type Msg = {
  id: string;
  user_id: string;
  nickname: string | null;
  message: string;
  created_at: number;
};

function formatTime(ts: number) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function ArenaChatWidget() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const since = useMemo(() => (messages.length ? messages[messages.length - 1].created_at : 0), [messages]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const on = () => setIsMobile(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/arena/chat?limit=60", { credentials: "include", cache: "no-store" }).catch(() => null);
      const j = await r?.json().catch(() => null);
      if (cancelled) return;
      if (j?.ok && Array.isArray(j.messages)) setMessages(j.messages);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // SSE live updates
    const es = new EventSource(`/api/arena/chat/stream?since=${since}`, { withCredentials: true } as any);

    const onMsg = (ev: MessageEvent) => {
      try {
        const m = JSON.parse(ev.data) as Msg;
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          const next = [...prev, m].slice(-200);
          return next;
        });
      } catch {
        // ignore
      }
    };

    es.addEventListener("message", onMsg as any);
    return () => {
      es.close();
    };
  }, [since]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, open]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await fetch("/api/arena/chat", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: text }),
    }).catch(() => {});
  }

  const panel = (
    <div
      className={cn(
        "w-[340px] max-w-[92vw]",
        "rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl shadow-2xl",
        "overflow-hidden"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <MessageCircle className="size-4 text-white/80" />
        <div className="text-sm font-semibold text-white/90">Arena chat</div>
        {isMobile ? (
          <button
            onClick={() => setOpen(false)}
            className="ml-auto inline-flex items-center justify-center size-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8"
            aria-label="Close chat"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="h-[270px] overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className="text-xs text-white/80 leading-snug">
            <div className="flex items-baseline gap-2">
              <span className="text-white/60">{formatTime(m.created_at)}</span>
              <span className="font-semibold text-white/90">{m.nickname || "Player"}</span>
            </div>
            <div className="pl-[46px] break-words">{m.message}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-2 border-t border-white/10">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Write a message…"
            className={cn(
              "flex-1 px-3 py-2 rounded-xl",
              "bg-white/5 border border-white/10",
              "text-sm text-white/85 placeholder:text-white/35",
              "outline-none focus:border-white/20 focus:bg-white/7"
            )}
            maxLength={200}
          />
          <button
            onClick={send}
            className="inline-flex items-center justify-center size-10 rounded-xl btn-accent"
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  // Desktop: always visible bottom-right
  if (!isMobile) {
    return <div className="fixed bottom-4 right-4 z-[60]">{panel}</div>;
  }

  // Mobile: floating button, open panel on click
  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-end p-3">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} />
          <div className="relative">{panel}</div>
        </div>
      ) : null}

      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-20 right-4 z-[60]",
          "inline-flex items-center justify-center size-12",
          "rounded-2xl btn-accent shadow-2xl"
        )}
        aria-label="Open chat"
      >
        <MessageCircle className="size-5" />
      </button>
    </>
  );
}
