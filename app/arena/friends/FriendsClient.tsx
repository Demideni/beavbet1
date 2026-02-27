"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ArenaShell from "../ArenaShell";
import { cn } from "@/components/utils/cn";
import { Search, UserPlus } from "lucide-react";

type FriendRow = {
  userId: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  status?: string | null; // accepted/pending etc
  online?: boolean | null;
};

export default function FriendsClient() {
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<FriendRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/arena/friends", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "LOAD_FAILED");

      // ожидаем что API вернёт friends: []
      const list = Array.isArray(j?.friends) ? j.friends : Array.isArray(j?.items) ? j.items : [];
      setRows(list);
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => (r.nickname || "").toLowerCase().includes(s));
  }, [q, rows]);

  return (
    <ArenaShell>
      <div className="mx-auto max-w-[1100px] px-3 md:px-6 py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-white text-2xl font-extrabold">Друзья</div>
          <button
            className="h-11 px-4 rounded-2xl bg-white/8 border border-white/10 hover:bg-white/10 text-white font-semibold"
            onClick={load}
            disabled={loading}
          >
            {loading ? "…" : "Refresh"}
          </button>
        </div>

        <div className="mt-3 rounded-3xl border border-white/10 bg-black/35 backdrop-blur-xl p-3">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 h-11">
            <Search className="h-4 w-4 text-white/45" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск"
              className="flex-1 bg-transparent outline-none text-white/85 placeholder:text-white/35"
            />
            <div className="text-white/35 text-xs">{filtered.length}</div>
          </div>

          {err ? (
            <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-red-200 text-sm">
              {err}
            </div>
          ) : null}

          <div className="mt-3 grid gap-2">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-white/60">Загрузка…</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-white/60">
                Друзей пока нет.
              </div>
            ) : (
              filtered.map((f) => (
                <div key={f.userId} className="rounded-2xl border border-white/10 bg-black/25 p-3 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl overflow-hidden border border-white/10 bg-black/30 shrink-0 relative">
                    {f.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-white/35 text-[10px]">NO</div>
                    )}
                    <span
                      className={cn(
                        "absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-black/60",
                        f.online ? "bg-emerald-400" : "bg-white/25"
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold truncate">{f.nickname || "Player"}</div>
                    <div className="text-white/45 text-xs truncate">{f.status || ""}</div>
                  </div>

                  <Link
                    href={`/arena/room?id=${encodeURIComponent(f.userId)}`}
                    className="h-10 px-4 rounded-2xl bg-white/8 border border-white/10 hover:bg-white/10 text-white font-semibold grid place-items-center"
                  >
                    Комната
                  </Link>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 text-white/35 text-xs flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Добавление друзей — через кнопку “Add friend” в комнате игрока (мы уже сделали).
          </div>
        </div>
      </div>
    </ArenaShell>
  );
}