"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type FriendItem = {
  id: string;
  nickname: string;
  avatarUrl?: string | null;
};

function normalize(s: string) {
  return (s || "").trim().toLowerCase();
}

function Avatar({ url, name }: { url?: string | null; name: string }) {
  const letter = (name?.trim()?.[0] || "?").toUpperCase();

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={name}
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold">
      {letter}
    </div>
  );
}

export default function FriendsClient() {
  const router = useRouter();

  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/arena/friends", { cache: "no-store" });
        if (!res.ok) throw new Error(`friends fetch failed: ${res.status}`);
        const data = (await res.json()) as { friends: FriendItem[] };

        if (!alive) return;
        setFriends(Array.isArray(data?.friends) ? data.friends : []);
      } catch (e) {
        if (!alive) return;
        setFriends([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return friends;
    return friends.filter((f) => normalize(f.nickname).includes(q));
  }, [friends, query]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-4 md:py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-bold">Друзья</h1>
          <p className="text-sm text-white/60">
            {loading ? "Загрузка…" : `${friends.length} друзей`}
          </p>
        </div>

        {/* Search */}
        <div className="w-[220px] md:w-[320px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск друзей"
            className="w-full rounded-xl bg-black/35 border border-white/10 px-3 py-2 text-sm outline-none focus:border-orange-500/60"
          />
        </div>
      </div>

      {/* List container */}
      <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
        {/* Top bar like VK list header */}
        <div className="px-4 py-3 border-b border-white/10 text-sm text-white/70">
          Все друзья
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-xl bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-white/60">
            {query ? "Ничего не найдено." : "Список друзей пуст."}
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {filtered.map((f) => (
              <button
                key={f.id}
                onClick={() => router.push(`/arena/player/${f.id}`)}
                className="w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center gap-3"
              >
                <Avatar url={f.avatarUrl} name={f.nickname} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm md:text-base font-semibold truncate">
                    {f.nickname}
                  </div>
                  <div className="text-xs text-white/50 truncate">
                    Открыть профиль
                  </div>
                </div>

                {/* little chevron */}
                <div className="text-white/35 text-lg leading-none">›</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mobile spacing / bottom safe area */}
      <div className="h-6 md:h-10" />
    </div>
  );
}