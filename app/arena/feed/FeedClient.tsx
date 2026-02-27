"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ArenaShell from "../ArenaShell";
import { cn } from "@/components/utils/cn";

type FeedItem =
  | {
      type: "post";
      id: string;
      createdAt: number;
      actorUserId: string;
      actorNick: string | null;
      actorAvatarUrl: string | null;
      text: string | null;
      imageUrl: string | null;
    }
  | {
      type: "event";
      id: string;
      createdAt: number;
      kind: string;
      actorUserId: string;
      actorNick: string | null;
      actorAvatarUrl: string | null;
      targetUserId: string | null;
      targetNick: string | null;
      meta: any;
    };

function fmt(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function displayNick(nick: string | null, fallback: string) {
  const n = (nick || "").trim();
  return n ? n : fallback;
}

function eventText(e: Extract<FeedItem, { type: "event" }>) {
  const actor = displayNick(e.actorNick, "Player");
  const target = e.targetNick ? displayNick(e.targetNick, "Player") : null;

  if (e.kind === "follow") return target ? `${actor} подписался на ${target}` : `${actor} подписался`;
  if (e.kind === "profile_update") return `${actor} обновил профиль`;
  if (e.kind === "room_update") return `${actor} обновил комнату`;
  if (e.kind === "post_create") return `${actor} сделал пост`;
  return `${actor}: ${e.kind}`;
}

export default function ArenaFeedClient() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/arena/feed?limit=60", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "LOAD_FAILED");
      setItems(Array.isArray(j?.items) ? j.items : []);
      setFollowingCount(Number(j?.followingCount || 0));
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const empty = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  return (
    <ArenaShell>
      <div className="mx-auto max-w-[1100px] px-3 md:px-6 py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-white text-2xl font-extrabold">Лента</div>
            <div className="text-white/55 text-sm mt-1">
              Посты и обновления от тебя и игроков, на которых ты подписан • following: {followingCount}
            </div>
          </div>

          <button
            className="h-11 px-4 rounded-2xl bg-white/8 border border-white/10 hover:bg-white/10 text-white font-semibold"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-red-200 text-sm">{err}</div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-black/25 p-5 text-white/60">Загрузка…</div>
          ) : null}

          {empty ? (
            <div className="rounded-3xl border border-white/10 bg-black/25 p-5 text-white/60">
              Тут пока пусто. Подпишись на игроков — и здесь появятся их посты/обновления.
            </div>
          ) : null}

          {!loading &&
            items.map((it) => (
              <div key={it.id} className="rounded-3xl border border-white/10 bg-black/25 overflow-hidden">
                <div className="p-4 md:p-5 flex items-start gap-3">
                  <div className="h-11 w-11 rounded-2xl overflow-hidden border border-white/10 bg-black/30 shrink-0">
                    {it.actorAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.actorAvatarUrl} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-white/35 text-[10px]">NO</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-white/90 font-bold truncate">
                        <Link className="hover:opacity-90" href={`/arena/room?id=${encodeURIComponent(it.actorUserId)}`}>
                          {displayNick(it.actorNick, "Player")}
                        </Link>
                      </div>
                      <div className="text-white/40 text-xs shrink-0">{fmt(it.createdAt)}</div>
                    </div>

                    {it.type === "event" ? (
                      <div className="mt-2 text-white/80 text-sm">{eventText(it)}</div>
                    ) : (
                      <>
                        {it.text ? <div className="mt-2 text-white text-sm whitespace-pre-wrap">{it.text}</div> : null}
                      </>
                    )}
                  </div>
                </div>

                {it.type === "post" && it.imageUrl ? (
                  <div className="border-t border-white/10 bg-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.imageUrl} alt="post" className={cn("w-full object-cover", "max-h-[520px]")} />
                  </div>
                ) : null}
              </div>
            ))}
        </div>
      </div>
    </ArenaShell>
  );
}