"use client";

import { Search, Settings, MessageCircle, Gift, Bell } from "lucide-react";
import Link from "next/link";
import { Logo } from "./Logo";
import { cn } from "@/components/utils/cn";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { usePathname } from "next/navigation";

type MeUser = { id: string; email: string; nickname: string | null; currency?: string; balance?: number } | null;

export function Topbar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [user, setUser] = useState<MeUser>(null);
  const [incomingFriends, setIncomingFriends] = useState(0);
  const [unreadDm, setUnreadDm] = useState(0);


  async function fetchNotif() {
    const r = await fetch("/api/arena/notifications", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (j?.ok) {
      setIncomingFriends(Number(j.incomingFriends || 0));
      setUnreadDm(Number(j.unreadDm || 0));
    }
  }

  async function fetchMe() {
    const r = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setUser(j?.user ?? null);
  }

  useEffect(() => {
  fetchMe();
  fetchNotif();

  const onRefresh = () => fetchMe();
  window.addEventListener("wallet:refresh", onRefresh);

  // mobile detector for positioning
  let mq: MediaQueryList | null = null;
  const onMq = () => {
    try {
      setIsMobile(Boolean(mq?.matches));
    } catch {}
  };
  try {
    mq = window.matchMedia("(max-width: 768px)");
    onMq();
    mq.addEventListener?.("change", onMq);
  } catch {}

  function playBeep() {
    try {
      // WebAudio beep (works without assets)
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.08;
      o.start();
      setTimeout(() => {
        try { o.stop(); } catch {}
        try { ctx.close(); } catch {}
      }, 140);
    } catch {}
  }

  function pushToast(title: string, body: string) {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => {
      const next = [...prev, { id, title, body, ts: Date.now() }];
      return next.slice(-3);
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }

  let es: EventSource | null = null;
  let poll: any = null;

  // Arena notifications stream. Also keep polling as fallback.
  es = new EventSource("/api/arena/notifications/stream");
  es.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data?.type === "friend_request") {
        setIncomingFriends((c) => c + 1);
      }
      if (data?.type === "dm_message") {
        setUnreadDm((c) => c + 1);

        const title = data?.fromNick ? String(data.fromNick) : "New message";
        const body = data?.preview ? String(data.preview) : "New message";
        pushToast(title, body);

        // sound
        playBeep();

        // system notification (best-effort; on iOS needs PWA)
        try {
          const canNotify = typeof window !== "undefined" && "Notification" in window;
          if (canNotify) {
            if (Notification.permission === "granted") {
              // show only if tab is not focused
              if (document.visibilityState !== "visible") {
                new Notification(title, { body });
              }
            } else if (Notification.permission === "default") {
              // don't spam prompts; request once after a user gesture is better
            }
          }
        } catch {}
      }
    } catch {}
  };
  es.onerror = () => {
    try { es?.close(); } catch {}
    es = null;
  };

  poll = setInterval(fetchNotif, 12000);

  return () => {
    window.removeEventListener("wallet:refresh", onRefresh);
    try { es?.close(); } catch {}
    if (poll) clearInterval(poll);
    try { mq?.removeEventListener?.("change", onMq); } catch {}
  };
}, []);

  const initials = user?.nickname?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase();
  const balanceText = user?.balance != null ? `${user.balance.toFixed(2)} ${user.currency || "EUR"}` : null;

  const isArena = pathname?.startsWith("/arena");

  if (isArena) {
    return (
      <header className="sticky top-0 z-40 backdrop-blur-md bg-bg/70 border-b border-white/5">
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
                    // quick jump: if there are friend requests -> open friends tab, else open messages
                    if (incomingFriends > 0) window.location.href = "/arena/profile?tab=friends";
                    else window.location.href = "/arena/profile?tab=messages";
                  }}
                  className="relative inline-flex items-center justify-center size-11 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8"
                  aria-label="Notifications"
                >
                  <Bell className="size-5 text-white/85" />
                  {(incomingFriends + unreadDm) > 0 ? (
                    <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-accent text-black text-xs font-extrabold flex items-center justify-center">
                      {incomingFriends + unreadDm}
                    </span>
                  ) : null}
                </button>

                {/* flag-only */}
                <LanguageSwitcher compact />

                <Link
                  href="/arena/profile"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/8 border border-white/10 text-sm hover:bg-white/10"
                  aria-label={t("topbar.profile")}
                >
                  <span className="size-8 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center font-semibold">
                    {initials}
                  </span>
                  <span className="hidden sm:block">{t("topbar.profile")}</span>
                </Link>
              </>
            ) : (
              <>
                <LanguageSwitcher compact />
                <Link
                  href="/auth?tab=login"
                  className="px-4 py-2 rounded-2xl bg-white/8 border border-white/10 text-sm hover:bg-white/10"
                >
                  {t("topbar.login")}
                </Link>
              </>
            )}
          </div>
        </div>

{/* In-app message toasts */}
{toasts.length > 0 ? (
  <div
    className={cn(
      "fixed z-[9999] pointer-events-none",
      isMobile ? "top-4 left-4 right-4" : "left-6 bottom-24"
    )}
  >
    <div className={cn("space-y-2", isMobile ? "" : "w-[360px]")}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl shadow-2xl px-4 py-3"
        >
          <div className="text-white font-extrabold text-sm truncate">{t.title}</div>
          <div className="text-white/80 text-sm mt-0.5 break-words">{t.body}</div>
        </div>
      ))}
    </div>
  </div>
) : null}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-bg/70 border-b border-white/5">
      <div className="h-16 px-4 lg:px-6 flex items-center gap-3">
        <Logo />

        {/* Mobile: square бонусы icon like in the reference */}
        <Link
          href="/bonuses"
          className="md:hidden inline-flex items-center justify-center size-11 rounded-2xl icon-pill text-white/85"
          aria-label={t("topbar.bonuses")}
        >
          <Gift className="size-5" />
        </Link>

        {/* Desktop: бонусы + search */}
        <button className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-xl icon-pill text-sm text-white/80 hover:text-white">
          <span className="text-base">🎁</span>
          {t("topbar.bonuses")}
        </button>

        <div className="hidden md:flex flex-1 items-center">
          <div className="w-full max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/45" />
            <input
              placeholder={t("topbar.searchPlaceholder")}
              className={cn(
                "w-full pl-10 pr-3 py-2.5 rounded-xl",
                "bg-white/5 border border-white/10",
                "outline-none focus:border-white/20 focus:bg-white/7",
                "text-sm text-white/85 placeholder:text-white/35"
              )}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {user ? (
            <div className="flex items-center gap-2">
              {balanceText ? (
                <Link
                  href="/payments"
                  className="inline-flex items-center px-3 py-2 rounded-2xl bg-white/5 border border-white/10 text-sm text-white/85 hover:bg-white/8"
                  aria-label={t("topbar.balance")}
                >
                  {balanceText}
                </Link>
              ) : null}
              <Link
                href="/arena/profile"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/8 border border-white/10 text-sm hover:bg-white/10"
                aria-label={t("topbar.profile")}
              >
              <span className="size-8 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center font-semibold">
                {initials}
              </span>
              <span className="hidden sm:block">{t("topbar.cabinet")}</span>
              </Link>
            </div>
          ) : (
            <>
              <Link
                href="/auth?tab=login"
                className="px-4 py-2 rounded-2xl bg-white/8 border border-white/10 text-sm hover:bg-white/10"
              >
                {t("topbar.login")}
              </Link>
              <Link
                href="/auth?tab=register"
                className="px-4 py-2 rounded-2xl btn-accent text-sm font-semibold"
              >
                {t("topbar.register")}
              </Link>
            </>
          )}

          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>
          <div className="md:hidden">
            <LanguageSwitcher compact />
          </div>
          <button className="hidden md:inline-flex items-center justify-center size-10 rounded-xl bg-white/6 border border-white/10 hover:bg-white/8">
            <Settings className="size-4" />
          </button>
          <button className="inline-flex items-center justify-center size-10 rounded-xl bg-white/6 border border-white/10 hover:bg-white/8">
            <MessageCircle className="size-4" />
          </button>
        </div>
      </div>

      {/* subtle progress line like in the reference header */}
      <div className="h-[2px] bg-white/5">
        <div className="h-full w-[18%] bg-white/35" />
      </div>
    </header>
  );
}
