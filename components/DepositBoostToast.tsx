"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  minutes?: number;
  percent?: number;
  storageKey?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function hasSessionCookie(): boolean {
  if (typeof document === "undefined") return false;
  // Server uses SESSION_COOKIE = "bb_session"
  return document.cookie.split(";").some((c) => c.trim().startsWith("bb_session="));
}

export default function DepositBoostToast({
  minutes = 30,
  percent = 170,
  storageKey = "beavbet_deposit_boost_v1",
}: Props) {
  const router = useRouter();
  const ttlMs = minutes * 60 * 1000;

  const [hidden, setHidden] = useState(true);
  const [endAt, setEndAt] = useState<number | null>(null);
  // IMPORTANT: avoid hydration mismatch (React #310/#418).
  // Date.now() in initial state renders different HTML on server vs client.
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.dismissed) return;
        setEndAt(parsed.endAt);
        setHidden(false);
        return;
      }
      const e = Date.now() + ttlMs;
      localStorage.setItem(storageKey, JSON.stringify({ endAt: e }));
      setEndAt(e);
      setHidden(false);
    } catch {
      setEndAt(Date.now() + ttlMs);
      setHidden(false);
    }
  }, [storageKey, ttlMs]);

  useEffect(() => {
    if (!mounted || hidden || !endAt) return;
    const id = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(id);
  }, [mounted, hidden, endAt]);

  const remainingMs = useMemo(
    () => (endAt ? Math.max(0, endAt - now) : 0),
    [endAt, now]
  );

  const sec = Math.floor(remainingMs / 1000);
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;

  if (!mounted || hidden || remainingMs <= 0) return null;

  const dismiss = () => {
    setHidden(true);
    localStorage.setItem(storageKey, JSON.stringify({ endAt, dismissed: true }));
  };

  const goDeposit = () => {
    const next = "/payments";
    if (hasSessionCookie()) {
      router.push(next);
    } else {
      router.push(`/auth?tab=register&next=${encodeURIComponent(next)}`);
    }
  };

  return (
    <div
      className="
        fixed z-[60]
        right-2 sm:right-4
        bottom-[15vh]
        w-[78%] max-w-[380px]
      "
    >
      <div
        onClick={goDeposit}
        role="button"
        className="
          cursor-pointer select-none
          flex items-center justify-between gap-2
          rounded-xl
          px-3 py-2
          border border-blue-300/20
          bg-gradient-to-r from-blue-700/60 via-blue-600/50 to-blue-500/40
          backdrop-blur
          shadow-xl
          active:scale-[0.99]
        "
      >
        <div className="flex items-center gap-3">
          <div className="text-base font-semibold text-white">
            Буст депозита 🔥 {percent}%
          </div>
          <div className="text-base font-bold text-white/95 tabular-nums">
            {pad2(mm)}:{pad2(ss)}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          className="
            h-7 w-7 rounded-lg
            grid place-items-center
            text-white/70 hover:text-white
            hover:bg-white/15
          "
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
