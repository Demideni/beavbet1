"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Mic, Square, X } from "lucide-react";
import { cn } from "@/components/utils/cn";

type Msg = {
  id: string;
  threadId: string;
  senderId: string;
  senderNick?: string | null;
  message: string;
  createdAt: number;
};

function parseSpecial(msg: string): { kind: "audio" | "img" | "text"; url?: string; text?: string } {
  const s = String(msg || "");
  const audio = s.match(/^__AUDIO__(?:[:\s]+)(.+)$/i);
  if (audio?.[1]) return { kind: "audio", url: audio[1].trim() };

  const img = s.match(/^__IMG__(?:[:\s]+)(.+)$/i);
  if (img?.[1]) return { kind: "img", url: img[1].trim() };

  return { kind: "text", text: s };
}

export default function DmModal({
  open,
  onClose,
  withUserId,
  withNick,
}: {
  open: boolean;
  onClose: () => void;
  withUserId: string;
  withNick?: string | null;
}) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [meId, setMeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [recState, setRecState] = useState<"idle" | "recording" | "uploading">("idle");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

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
    const r = await fetch(`/api/arena/dm/messages?threadId=${encodeURIComponent(tid)}&limit=80`, { cache: "no-store" });
    const j = await r.json().catch(() => ({} as any));
    const arr = Array.isArray((j as any)?.messages) ? ((j as any).messages as Msg[]) : Array.isArray(j) ? (j as Msg[]) : [];
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
      } catch {
        // ignore
      }
    };
    es.onerror = () => {
      // allow browser to retry
    };
    esRef.current = es;
  }

  useEffect(() => {
    if (!open) return;
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
      // stop recorder if open closes
      try {
        recRef.current?.stop();
      } catch {}
      recRef.current = null;
      chunksRef.current = [];
      setRecState("idle");
    };
  }, [open, withUserId]);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function sendMessage(message: string) {
    if (!threadId) return;
    const r = await fetch("/api/arena/dm/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, message }),
    });
    if (!r.ok) throw new Error("Send failed");
  }

  async function sendText() {
    if (!threadId) return;
    const msg = text.trim();
    if (!msg) return;
    setBusy(true);
    setText("");
    try {
      await sendMessage(msg);
    } catch {
      setText(msg);
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(endpoint: "/api/arena/uploads/audio" | "/api/arena/uploads/image", file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(endpoint, { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || "UPLOAD_FAILED");
    return String(j?.url || "");
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!threadId) return;
    setBusy(true);
    try {
      const url = await uploadFile("/api/arena/uploads/image", f);
      if (!url) throw new Error("NO_URL");
      await sendMessage(`__IMG__: ${url}`);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  async function toggleRec() {
    if (recState === "recording") {
      try {
        recRef.current?.stop();
      } catch {}
      return;
    }
    if (recState !== "idle") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        chunksRef.current = [];
        recRef.current = null;

        if (!threadId) {
          setRecState("idle");
          return;
        }

        setRecState("uploading");
        try {
          const file = new File([blob], "voice.webm", { type: blob.type || "audio/webm" });
          const url = await uploadFile("/api/arena/uploads/audio", file);
          if (url) await sendMessage(`__AUDIO__: ${url}`);
        } catch {
          // ignore
        } finally {
          setRecState("idle");
        }
      };
      recRef.current = mr;
      mr.start();
      setRecState("recording");
    } catch {
      setRecState("idle");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-3">
      <div className="w-full max-w-[620px] rounded-3xl border border-white/12 bg-black/55 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="text-white font-extrabold">{title}</div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-2xl bg-white/6 border border-white/10 hover:bg-white/10 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        <div className="h-[55vh] md:h-[420px] overflow-y-auto px-4 py-3 space-y-2">
          {messages.map((m) => {
            const mine = meId && m.senderId === meId;
            const parsed = parseSpecial(m.message);
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm border",
                    mine ? "bg-accent/20 border-accent/30 text-white" : "bg-white/6 border-white/10 text-white/90"
                  )}
                >
                  {!mine ? (
                    <div className="text-[11px] text-orange-400 font-semibold mb-1">{m.senderNick || ""}</div>
                  ) : null}

                  {parsed.kind === "audio" ? (
                    <audio className="w-[260px] max-w-full" controls src={parsed.url} />
                  ) : parsed.kind === "img" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={parsed.url}
                      alt="image"
                      className="max-w-[320px] w-full h-auto rounded-2xl border border-white/10"
                      loading="lazy"
                    />
                  ) : (
                    <div className="whitespace-pre-wrap break-words">{parsed.text}</div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={onPickImage}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || !threadId}
              className="h-11 w-11 rounded-2xl bg-white/6 border border-white/10 hover:bg-white/10 flex items-center justify-center disabled:opacity-50"
              aria-label="Attach image"
              title="Attach image"
            >
              <ImageIcon className="h-5 w-5 text-white" />
            </button>

            <button
              onClick={toggleRec}
              disabled={busy || !threadId}
              className={cn(
                "h-11 w-11 rounded-2xl border flex items-center justify-center disabled:opacity-50",
                recState === "recording" ? "bg-red-500/20 border-red-400/30" : "bg-white/6 border-white/10 hover:bg-white/10"
              )}
              aria-label="Voice message"
              title={recState === "recording" ? "Stop" : "Record"}
            >
              {recState === "recording" ? <Square className="h-5 w-5 text-white" /> : <Mic className="h-5 w-5 text-white" />}
            </button>

            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendText();
                }
              }}
              placeholder={recState === "uploading" ? "Uploading…" : "Write a message…"}
              className="flex-1 h-11 rounded-2xl bg-white/6 border border-white/10 px-3 text-white placeholder:text-white/40 outline-none"
              disabled={busy || recState === "uploading"}
            />

            <button
              onClick={sendText}
              disabled={busy || recState === "uploading"}
              className="h-11 px-4 rounded-2xl bg-accent text-black font-bold hover:opacity-95 disabled:opacity-60"
            >
              Send
            </button>
          </div>

          <div className="text-white/40 text-xs mt-2">
            Tip: Enter to send • Shift+Enter new line • {recState === "recording" ? "Recording…" : recState === "uploading" ? "Uploading voice…" : "Attach photo or voice"}
          </div>
        </div>
      </div>
    </div>
  );
}
