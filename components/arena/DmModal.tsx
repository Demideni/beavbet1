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
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

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
    // Backend can return either { messages: Msg[] } or Msg[]; also guard against non-array shapes.
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
            return [...prev, { id: m.id, threadId: m.thread_id, senderId: m.sender_id, senderNick: m.sender_nick ?? null, message: m.message, createdAt: m.created_at } as any];
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
    };
  }, [open, withUserId]);

  useEffect(() => {
    if (!open) return;
    // autoscroll
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

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
    if (!r.ok) {
      // restore
      setText(msg);
    }
  }

  async function sendSpecial(raw: string) {
    if (!threadId) return;
    setBusy(true);
    const r = await fetch("/api/arena/dm/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, message: raw }),
    });
    setBusy(false);
    if (!r.ok) {
      // noop
    }
  }

  async function uploadAndSendImage(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    const r = await fetch("/api/arena/uploads/image", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return alert(j?.error || "Upload failed");
    await sendSpecial(`__IMG__:${j.url}`);
  }

  async function startRec() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer webm for broad support; Safari may vary but will still download.
      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];
      const mimeType = mimeCandidates.find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m)) || "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch {}
        setRecording(false);
        setRec(null);
        if (!chunks.length) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const fd = new FormData();
        fd.set("file", new File([blob], "voice.webm", { type: blob.type }));
        const r = await fetch("/api/arena/uploads/audio", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return alert(j?.error || "Upload failed");
        await sendSpecial(`__AUDIO__:${j.url}`);
      };
      recorder.start();
      setRec(recorder);
      setRecording(true);
    } catch {
      alert("Microphone permission denied");
    }
  }

  function stopRec() {
    if (!rec) return;
    try {
      rec.stop();
    } catch {}
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-3">
      <div className="w-full max-w-[620px] rounded-3xl border border-white/12 bg-black/55 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="text-white font-extrabold">{title}</div>
          <button onClick={onClose} className="h-9 w-9 rounded-2xl bg-white/6 border border-white/10 hover:bg-white/10 flex items-center justify-center" aria-label="Close">
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        <div className="h-[55vh] md:h-[420px] overflow-y-auto px-4 py-3 space-y-2">
          {messages.map((m) => {
            const mine = meId && m.senderId === meId;
            const msg = String(m.message || "");
            const isAudio = msg.startsWith("__AUDIO__:");
            const isImg = msg.startsWith("__IMG__:");
            const url = (isAudio ? msg.slice("__AUDIO__:".length) : isImg ? msg.slice("__IMG__:".length) : "").trim();
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}> 
                <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm border", mine ? "bg-accent/20 border-accent/30 text-white" : "bg-white/6 border-white/10 text-white/90")}> 
                  {!mine ? (
                    <div className="text-[11px] text-orange-400 font-semibold mb-1">{m.senderNick || ""}</div>
                  ) : null}
                  {isAudio ? (
                    <audio controls preload="none" src={url} className="w-[260px] max-w-full" />
                  ) : isImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="image" className="max-w-[260px] rounded-xl border border-white/10" />
                  ) : (
                    <div className="whitespace-pre-wrap break-words">{m.message}</div>
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
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadAndSendImage(f);
              }}
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-11 w-11 rounded-2xl bg-white/6 border border-white/10 hover:bg-white/10 flex items-center justify-center"
              aria-label="Attach image"
              disabled={busy}
            >
              <ImageIcon className="h-4 w-4 text-white/85" />
            </button>

            <button
              type="button"
              onClick={() => (recording ? stopRec() : startRec())}
              className={cn(
                "h-11 w-11 rounded-2xl border flex items-center justify-center",
                recording ? "bg-accent text-black border-accent" : "bg-white/6 border-white/10 hover:bg-white/10"
              )}
              aria-label={recording ? "Stop recording" : "Record voice"}
              disabled={busy}
            >
              {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4 text-white/85" />}
            </button>

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
          <div className="text-white/40 text-xs mt-2">Tip: Enter to send • Shift+Enter new line</div>
        </div>
      </div>
    </div>
  );
}