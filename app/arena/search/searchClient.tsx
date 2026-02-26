"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import ArenaShell from "../ArenaShell";

type Row = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  elo: number;
  division: string;
  place: number;
};

export default function SearchClient() {
  const sp = useSearchParams();
  const q = String(sp.get("q") || "").trim();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!q) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const r = await fetch(`/api/arena/players/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        setRows(Array.isArray(j?.rows) ? j.rows : []);
      } catch {
        // ignore
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [q]);

  return (
    <ArenaShell>
      <div className="mx-auto max-w-[1400px] px-3 md:px-6 pb-10">
        <div className="rounded-3xl border border-white/10 bg-black/35 backdrop-blur-xl p-4 md:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="text-white text-xl font-extrabold tracking-tight">Поиск игроков</div>
              <div className="mt-1 text-white/55 text-sm">
                Запрос: <span className="text-white/85 font-semibold">{q || "—"}</span>
              </div>
            </div>
            <div className="text-white/45 text-xs">{loading ? "loading…" : `${rows.length} результатов`}</div>
          </div>

          <div className="mt-5 grid gap-3">
            {q && rows.length === 0 && !loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/3 p-4 text-white/55 text-sm">
                Ничего не найдено.
              </div>
            ) : null}

            {rows.map((r) => (
              <Link
                key={r.userId}
                href={`/arena/room/${encodeURIComponent(r.userId)}`}
                className="rounded-3xl border border-white/10 bg-white/3 hover:bg-white/5 transition-colors p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-12 w-12 rounded-2xl overflow-hidden border border-white/10 bg-black/30 shrink-0">
                    {r.avatarUrl ? (
                      <Image src={r.avatarUrl} alt="avatar" fill className="object-cover" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-white/35 text-[10px]">NO</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-extrabold truncate">{r.nickname}</div>
                    <div className="mt-1 text-white/55 text-xs truncate">
                      BeavRank {r.elo} • {r.division} • #{r.place}
                    </div>
                  </div>
                </div>

                <div className="text-white/55 text-xs shrink-0">Открыть →</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </ArenaShell>
  );
}