"use client";

import { Search, Settings, MessageCircle, Gift, Bell } from "lucide-react";
import Link from "next/link";
import { Logo } from "./Logo";
import { cn } from "@/components/utils/cn";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { usePathname } from "next/navigation";

type MeUser =
  | { id: string; email: string; nickname: string | null; currency?: string; balance?: number }
  | null;

export function Topbar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const hideTopbar = pathname === "/"; // ✅ hide on landing, but DON'T early-return before hooks

  const [user, setUser] = useState<MeUser>(null);
  const [incomingFriends, setIncomingFriends] = useState(0);
  const [unreadDm, setUnreadDm] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; title: string; body: string; threadId?: string }[]>([]);

  const lastUnreadRef = useRef(0);
  const lastFriendRef = useRef(0);

  function playPing() {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.06;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => {
        try {
          o.stop();
        } catch {}
        try {
          ctx.close();
        } catch {}
      }, 140);
    } catch {}
  }

  function pushToast(t: { title: string; body: string; threadId?: string }) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [{ id, ...t }, ...prev].slice(0, 3));
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4500);
  }

  async function fetchNotif() {
    const r = await fetch("/api/arena/notifications", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (j?.ok) {
      const nextFriends = Number(j.incomingFriends || 0);
      const nextUnread = Number(j.unreadDm || 0);

      // If unread DM increases, show a toast + sound (poll fallback)
      if (nextUnread > lastUnreadRef.current) {
        try {
          const tr = await fetch("/api/arena/dm/threads", { cache: "no-store" });
          const tj = await tr.json().catch(() => ({}));
          const top = Array.isArray(tj?.threads) && tj.threads.length ? tj.threads[0] : null;
          pushToast({
            title: top?.otherNick ? String(top.otherNick) : "New message",
            body: top?.lastMessage ? String(top.lastMessage) : "У тебя новое сообщение",
            threadId: top?.threadId ? String(top.threadId) : undefined,
          });
        } catch {
          pushToast({ title: "New message", body: "У тебя новое сообщение" });
        }
        playPing();
      }

      setIncomingFriends(nextFriends);
      setUnreadDm(nextUnread);
      lastUnreadRef.current = nextUnread;
      lastFriendRef.current = nextFriends;
    }
  }

  async function fetchMe() {
    const r = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setUser(j?.user ?? null);
  }

  useEffect(() => {
    // ✅ If we hide topbar on "/", do nothing (but hooks order stays consistent)
    if (hideTopbar) return;

    fetchMe();
    fetchNotif();

    const mq = typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)") : null;
    const onMq = () => {
      try {
        setIsMobile(Boolean(mq?.matches));
      } catch {}
    };
    onMq();
    try {
      mq?.addEventListener?.("change", onMq);
      // safari fallback
      mq?.addListener?.(onMq as any);
    } catch {}

    const onRefresh = () => fetchMe();
    window.addEventListener("wallet:refresh", onRefresh);

    let es: EventSource | null = null;
    let poll: any = null;

    // Arena notifications stream + polling fallback
    try {
      es = new EventSource("/api/arena/notifications/stream");
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data?.type === "friend_request") {
            setIncomingFriends((c) => c + 1);
          }
          if (data?.type === "dm_message") {
            setUnreadDm((c) => c + 1);
            pushToast({
              title: data?.fromNick ? String(data.fromNick) : "New message",
              body: String(data?.preview || ""),
              threadId: data?.threadId ? String(data.threadId) : undefined,
            });
            playPing();
          }
        } catch {}
      };
      es.onerror = () => {
        try {
          es?.close();
        } catch {}
        es = null;
      };
    } catch {
      es = null;
    }

    poll = setInterval(fetchNotif, 12000);

    return () => {
      window.removeEventListener("wallet:refresh", onRefresh);
      try {
        mq?.removeEventListener?.("change", onMq);
        mq?.removeListener?.(onMq as any);
      } catch {}
      try {
        es?.close();
      } catch {}
      if (poll) clearInterval(poll);
    };
  }, [hideTopbar]);

  // ✅ Now it's safe to return null AFTER hooks
  if (hideTopbar) return null;

  const initials = user?.nickname?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase();
  const balanceText = user?.balance != null ? `${user.balance.toFixed(2)} ${user.currency || "EUR"}` : null;

  const isArena = pathname?.startsWith("/arena");

  if (isArena) {
    return (
      <header className="sticky top-0 z-40 backdrop-blur-md bg-transparent">
        {/* Toasts */}
        {toasts.length ? (
          <div
            className={cn(
              "fixed z-[90]",
              isMobile ? "top-4 left-1/2 -translate-x-1/2 w-[92vw] max-w-[420px]" : "bottom-24 left-6 w-[360px]"
            )}
          >
            <div className="space-y-2">
              {toasts.map((tt) => (
                <button
                  key={tt.id}
                  onClick={() => {
                    window.location.href = "/arena/profile?tab=messages";
                  }}
                  className="w-full text-left rounded-2xl border border-white/12 bg-black/55 backdrop-blur-xl px-4 py-3 shadow-2xl hover:bg-black/65"
                >
                  <div className="text-white font-extrabold text-sm truncate">{tt.title}</div>
                  <div className="text-white/75 text-sm mt-0.5 truncate">{tt.body}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="h-16 px-4 lg:px-6 flex items-center gap-3">
          <Logo subtitle="ARENA" href="/arena" />

          <div className="flex items-center gap-2 ml-auto">
            {user ? (
              <>
                {balanceText ? (
                  <Link
                    href="/payments"
                    className="inline-flex items-center px-3 py-2 rounded-2xl bg-white/5 border border-white/10 text-sm text-white/85 hover:bg-white/8"
                    aria-label={t("topbar.balance")}
                  >
                    {balanceText}
                  </Link>
                ) : null}

                <button
                  onClick={() => {
                    if (incomingFriends > 0) window.location.href = "/arena/profile?tab=friends";
                    else window.location.href = "/arena/profile?tab=messages";
                  }}
                  className="relative inline-flex items-center justify-center size-11 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8"
                  aria-label="Notifications"
                >
                  <Bell className="size-5 text-white/85" />
                  {incomingFriends + unreadDm > 0 ? (
                    <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-accent text-black text-xs font-extrabold flex items-center justify-center">
                      {incomingFriends + unreadDm}
                    </span>
                  ) : null}
                </button>

                <Link
                  href="/account"
                  className="inline-flex items-center justify-center size-11 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8"
                  aria-label={t("topbar.cabinet")}
                >
                  <Settings className="size-5 text-white/85" />
                </Link>

                <Link
                  href="/arena/profile"
                  className="inline-flex items-center justify-center size-11 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8"
                  aria-label={t("topbar.profile")}
                >
                  <span className="text-white font-extrabold">{initials}</span>
                </Link>
              </>
            ) : (
              <Link href="/auth" className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold">
                {t("topbar.login")}
              </Link>
            )}
          </div>
        </div>
      </header>
    );
  }

  // Default site topbar
  return (
    <header className="sticky top-0 z-40 bg-[#0B1120]/75 backdrop-blur-md border-b border-white/10">
      <div className="h-16 px-4 lg:px-6 flex items-center gap-4">
        <Logo subtitle="Crypto Casino" href="/" />

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/bonuses"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8 text-white/85"
          >
            <Gift className="size-5" />
            <span className="text-sm font-semibold">{t("topbar.bonuses")}</span>
          </Link>
        </div>

        <div className="flex-1 hidden md:flex items-center">
          <div className="relative w-full max-w-[520px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/55" />
            <input
              placeholder={t("topbar.searchPlaceholder")}
              className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white/5 border border-white/10 text-white/90 placeholder:text-white/45 outline-none focus:border-white/20"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />

          {user ? (
            <>
              {balanceText ? (
                <Link
                  href="/payments"
                  className="hidden sm:inline-flex items-center px-3 py-2 rounded-2xl bg-white/5 border border-white/10 text-sm text-white/85 hover:bg-white/8"
                >
                  {balanceText}
                </Link>
              ) : null}

              <Link
                href="/arena/profile?tab=messages"
                className="relative inline-flex items-center justify-center size-11 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8"
                aria-label="Messages"
              >
                <MessageCircle className="size-5 text-white/85" />
                {unreadDm > 0 ? (
                  <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-accent text-black text-xs font-extrabold flex items-center justify-center">
                    {unreadDm}
                  </span>
                ) : null}
              </Link>

              <Link
                href="/arena/profile?tab=friends"
                className="relative inline-flex items-center justify-center size-11 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8"
                aria-label="Friends"
              >
                <Bell className="size-5 text-white/85" />
                {incomingFriends > 0 ? (
                  <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-accent text-black text-xs font-extrabold flex items-center justify-center">
                    {incomingFriends}
                  </span>
                ) : null}
              </Link>

              <Link
                href="/account"
                className="inline-flex items-center justify-center size-11 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8"
                aria-label={t("topbar.cabinet")}
              >
                <Settings className="size-5 text-white/85" />
              </Link>

              <Link
                href="/account"
                className="inline-flex items-center justify-center size-11 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8"
                aria-label={t("topbar.profile")}
              >
                <span className="text-white font-extrabold">{initials}</span>
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth" className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold">
                {t("topbar.login")}
              </Link>
              <Link href="/auth?mode=register" className="px-4 py-2 rounded-2xl bg-accent hover:opacity-90 text-black font-extrabold">
                {t("topbar.register")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}