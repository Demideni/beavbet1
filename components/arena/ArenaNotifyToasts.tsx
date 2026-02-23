"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/components/utils/cn";

type Ev =
  | { type: "friend_request"; fromUserId: string; fromNick?: string | null; createdAt: number }
  | { type: "friend_accepted"; byUserId: string; byNick?: string | null; createdAt: number }
  | { type: "dm_message"; fromUserId: string; fromNick?: string | null; threadId: string; createdAt: number; preview: string }
  | { type: "gift"; fromUserId: string; fromNick?: string | null; amount: number; currency: string; createdAt: number };

type Toast = { id: string; ev: Ev; ts: number };

export default function ArenaNotifyToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    try {
      esRef.current?.close();
    } catch {}
    const es = new EventSource("/api/arena/notify/stream");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data?.type !== "event" || !data?.ev) return;
        const ev: Ev = data.ev;
        const id = `${ev.type}:${(ev as any).createdAt ?? Date.now()}:${Math.random().toString(16).slice(2)}`;
        setToasts((prev) => [{ id, ev, ts: Date.now() }, ...prev].slice(0, 5));
        // auto-remove after 6s
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 6000);
      } catch {
        // ignore
      }
    };
    es.onerror = () => {
      // browser will retry
    };
    esRef.current = es;
    return () => {
      try {
        esRef.current?.close();
      } catch {}
      esRef.current = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[90] space-y-2 w-[320px] max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => setToasts((p) => p.filter((x) => x.id !== t.id))} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const ev = toast.ev;

  let title = "Notification";
  let body = "";
  let href: string | null = null;

  if (ev.type === "friend_request") {
    title = "Friend request";
    body = `${ev.fromNick || ev.fromUserId.slice(0, 6)} sent you a request`;
    href = "/arena/profile?tab=friends";
  } else if (ev.type === "friend_accepted") {
    title = "Friend added";
    body = `${ev.byNick || ev.byUserId.slice(0, 6)} accepted your request`;
    href = "/arena/profile?tab=friends";
  } else if (ev.type === "dm_message") {
    title = "New message";
    body = `${ev.fromNick || ev.fromUserId.slice(0, 6)}: ${ev.preview}`;
    href = "/arena/profile?tab=messages";
  } else if (ev.type === "gift") {
    title = "Gift received";
    body = `${ev.fromNick || ev.fromUserId.slice(0, 6)} sent you ${ev.amount} ${ev.currency}`;
    href = "/arena/profile";
  }

  const Card = (
    <div className={cn("rounded-3xl border border-white/12 bg-black/55 backdrop-blur-md shadow-2xl p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-white font-extrabold">{title}</div>
          <div className="text-white/70 text-sm mt-1 line-clamp-2">{body}</div>
        </div>
        <button onClick={onClose} className="h-8 w-8 rounded-2xl bg-white/6 border border-white/10 text-white/80 hover:bg-white/10">
          ×
        </button>
      </div>
      {href ? (
        <div className="mt-3">
          <Link href={href} className="text-accent font-bold text-sm hover:underline">
            Open
          </Link>
        </div>
      ) : null}
    </div>
  );

  return Card;
}
