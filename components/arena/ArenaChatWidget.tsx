"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import DmModal from "@/components/arena/DmModal";

type ChatMsg = {
  id: string;
  user_id: string;
  nickname: string | null;
  message: string;
  created_at: number;
  streamerBadge?: string | null;
};

function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ArenaChatWidget({
  mode = "floating",
}: {
  /**
   * floating: default widget (desktop bottom-right + mobile popup)
   * sidebar: embedded panel for the Arena left sidebar (desktop)
   */
  mode?: "floating" | "sidebar";
}) {
  const [openMobile, setOpenMobile] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [openDm, setOpenDm] = useState<{ id: string; nick?: string | null } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/arena/chat", { credentials: "include" }).catch(() => null);
      if (!r || !r.ok) return;
      const j = await r.json().catch(() => null);
      if (j?.messages) setMsgs(j.messages);
    })();

    try {
      const es = new EventSource("/api/arena/chat/stream");
      es.onmessage = (ev) => {
        const p = JSON.parse(ev.data || "{}") as any;
        if (p?.type === "msg" && p?.msg) {
          setMsgs((prev) => {
            const next = [...prev, p.msg];
            return next.slice(-200);
          });
        }
      };
      es.onerror = () => {
        try {
          es.close();
        } catch {}
      };
      return () => {
        try {
          es.close();
        } catch {}
      };
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    // autoscroll
    const el = boxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs.length, openMobile]);

  async function send() {
    const m = text.trim();
    if (!m) return;
    setSending(true);
    setText("");
    const r = await fetch("/api/arena/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: m }),
      credentials: "include",
    }).catch(() => null);
    setSending(false);
    if (!r) return;
    // if failed, restore text
    if (!r.ok) setText(m);
  }

  const panel = (
    <div className={mode === "sidebar" ? "w-full" : "w-[340px] max-w-[92vw]"}>
      <div
        className={
          mode === "sidebar"
            ? "rounded-3xl border border-white/10 bg-black/25 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col h-[320px]"
            : "rounded-3xl border border-white/10 bg-black/25 backdrop-blur-xl shadow-2xl overflow-hidden"
        }
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/15">
          <div className="flex items-center gap-2 text-white/85 font-semibold">
            <MessageSquare className="h-4 w-4" /> Arena chat
          </div>
          {isMobile ? (
            <button
              className="h-8 w-8 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
              onClick={() => setOpenMobile(false)}
              aria-label="Close chat"
            >
              <X className="h-4 w-4 text-white/80" />
            </button>
          ) : null}
        </div>

        <div
          ref={boxRef}
          className={
            mode === "sidebar"
              ? "flex-1 min-h-0 overflow-y-auto px-4 py-3 text-sm"
              : "h-[240px] overflow-y-auto px-4 py-3 text-sm"
          }
        >
          {msgs.map((m) => (
            <div key={m.id} className="flex gap-2 py-1">
              <div className="text-white/35 shrink-0 w-[42px]">{fmtTime(m.created_at)}</div>
              <div className="min-w-0">
                <button
                  className="text-emerald-400 font-semibold hover:underline"
                  onClick={() => setOpenDm({ id: m.user_id, nick: m.nickname })}
                  title="Message"
                >
                  {m.nickname || "Player"}
                  {m.streamerBadge ? (
                    <span className="ml-2 text-accent font-extrabold">[{m.streamerBadge}]</span>
                  ) : null}
                </button>
                <span className="text-white/55">: </span>
                <span className="text-white/80 break-words">{m.message}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="px-3 py-3 border-t border-white/10 bg-black/10">
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder="Write a message..."
              className="flex-1 h-10 rounded-2xl bg-black/25 border border-white/10 px-3 text-white/90 placeholder:text-white/35 outline-none focus:border-accent/60"
            />
            <button
              onClick={send}
              disabled={sending}
              className="h-10 w-10 rounded-2xl bg-accent text-black font-extrabold flex items-center justify-center hover:brightness-110 disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Desktop: always visible. Mobile: toggled.
  if (isMobile) {
    return (
      <>
        {!openMobile ? (
          <button
            className="fixed bottom-24 right-4 z-[60] h-12 w-12 rounded-2xl bg-black/35 border border-white/12 backdrop-blur-xl flex items-center justify-center hover:bg-black/45"
            onClick={() => setOpenMobile(true)}
            aria-label="Open chat"
          >
            <MessageSquare className="h-5 w-5 text-white/90" />
          </button>
        ) : null}

        {openMobile ? (
          <div className="fixed inset-0 z-[70] flex items-end justify-end p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpenMobile(false)} />
            <div className="relative">{panel}</div>
          </div>
        ) : null}

        <DmModal open={Boolean(openDm)} onClose={() => setOpenDm(null)} withUserId={openDm?.id || ""} withNick={openDm?.nick} />
      </>
    );
  }

  // Desktop
  if (mode === "sidebar") {
    return (
      <>
        {panel}
        <DmModal open={Boolean(openDm)} onClose={() => setOpenDm(null)} withUserId={openDm?.id || ""} withNick={openDm?.nick} />
      </>
    );
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-[60]">{panel}</div>
      <DmModal open={Boolean(openDm)} onClose={() => setOpenDm(null)} withUserId={openDm?.id || ""} withNick={openDm?.nick} />
    </>
  );
}
