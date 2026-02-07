"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type User = { id: string; email: string; balanceCents: number };

function fmtMoney(cents: number) {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function extractUser(payload: any): User | null {
  // Поддерживаем несколько форматов:
  // 1) { ok:true, data: { user } }
  // 2) { user }
  // 3) { ok:true, user }
  const u =
    payload?.data?.user ??
    payload?.user ??
    (payload?.ok ? payload?.user : null);

  if (!u?.id) return null;
  return u as User;
}

export default function TopBar() {
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const isAuthed = !!user;

  const shortId = useMemo(() => {
    if (!user?.id) return "";
    return `${user.id.slice(0, 6)}…${user.id.slice(-4)}`;
  }, [user?.id]);

  async function loadMe() {
    try {
      setLoading(true);

      const r = await fetch("/api/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const j = await r.json().catch(() => ({} as any));

      if (!r.ok) {
        setUser(null);
        return;
      }

      const u = extractUser(j);
      setUser(u);
    } finally {
      setLoading(false);
    }
  }

  // Перезагружаем состояние на каждом переходе страниц
  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    setUser(null);
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-30 bg-transparent">
  <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 py-0.015">
    {/* LEFT */}
    <div className="flex items-center justify-start gap-3">
      {loading ? (
        <div className="text-sm text-slate-400">Загрузка…</div>
      ) : isAuthed ? (
        <>
          <Link
            href="/account"
            className="flex items-center gap-2 rounded-full border border-slate-800/80 px-4 py-1.5 text-sm text-slate-100 hover:border-slate-300"
          >
            <span className="text-slate-400">Баланс</span>
            <span className="font-semibold">{fmtMoney(user!.balanceCents)}</span>
          </Link>

          <div className="hidden items-center gap-2 rounded-full border border-slate-800/80 px-4 py-1.5 text-sm text-slate-100 md:flex">
            <span className="text-slate-400">ID:</span>
            <span className="font-mono">{shortId}</span>
          </div>
        </>
      ) : (
        <Link
  href="/login"
  className="rounded-full bg-blue-600 px-5 py-1.5 text-sm font-semibold text-white shadow-[0_0_22px_rgba(59,130,246,0.9)] hover:bg-blue-500"
>
  Вход
</Link>

      )}
    </div>

    {/* CENTER */}
    <div className="flex items-center justify-center">
      <Link href="/" className="flex items-center justify-center">
        <img
          src="/pulz-logo-dark.png"
          alt="Pulz Casino"
          className="pulz-logo-animated h-20 w-auto"
        />
      </Link>
    </div>

    {/* RIGHT */}
    <div className="flex items-center justify-end gap-3">
      {loading ? null : isAuthed ? (
        <button
          onClick={logout}
          className="rounded-full bg-slate-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Выйти
        </button>
      ) : (
       <Link
  href="/register"
  className="
    rounded-full
    bg-lime-400
    px-6 py-1.5
    text-sm font-bold
    text-black
    shadow-[0_0_18px_rgba(163,230,53,0.9)]
    transition
    hover:bg-lime-300
    hover:shadow-[0_0_30px_rgba(163,230,53,1)]
    active:scale-95
  "
>
  Регистрация
</Link>
      )}
    </div>
  </div>
</header>
  );
}
