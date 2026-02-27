"use client";

import { useEffect, useMemo, useState } from "react";
import ArenaShell from "../ArenaShell";
import { cn } from "@/components/utils/cn";
import DmModal from "@/components/arena/DmModal";
import ImageUploadInline from "@/components/arena/ImageUploadInline";
import { Pencil, X } from "lucide-react";

type Room = {
  userId: string;
  backgroundUrl: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: number;
  updatedAt: number;
};

type Profile = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  elo: number;
  division: string;
  matches: number;
  wins: number;
  losses: number;
  winrate: number;
  place: number | null;
};

type Post = {
  id: string;
  userId: string;
  text: string;
  imageUrl: string | null;
  createdAt: number;
};

function ts(n: number) {
  try {
    return new Date(n).toLocaleString();
  } catch {
    return "";
  }
}

export default function RoomClient({ userId }: { userId?: string }) {
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [friendStatus, setFriendStatus] = useState<"none" | "pending_outgoing" | "pending_incoming" | "accepted">("none");

  const [editBg, setEditBg] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editBio, setEditBio] = useState("");

  const [postText, setPostText] = useState("");
  const [postImage, setPostImage] = useState("");

  const [dmOpen, setDmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const isMe = useMemo(() => !!meId && !!room?.userId && meId === room.userId, [meId, room?.userId]);

  async function loadAll() {
    setLoading(true);
    try {
      const qs = userId ? `?id=${encodeURIComponent(userId)}` : "";
      const r = await fetch(`/api/arena/room${qs}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      setMeId(j?.meId ?? null);
      setRoom(j?.room ?? null);
      setProfile(j?.profile ?? null);

      if (j?.room) {
        setEditBg(j.room.backgroundUrl ?? "");
        setEditAvatar(j.room.avatarUrl ?? "");
        setEditBio(j.room.bio ?? "");
      }

      const r2 = await fetch(`/api/arena/room/posts${qs}`, { cache: "no-store" });
      const j2 = await r2.json().catch(() => ({}));
      setPosts(Array.isArray(j2?.posts) ? j2.posts : []);

      const targetId = userId || j?.room?.userId;
      if (targetId && j?.meId && targetId !== j.meId) {
        const rp = await fetch(`/api/arena/player?id=${encodeURIComponent(targetId)}`, { cache: "no-store" });
        const jp = await rp.json().catch(() => ({}));
        if (rp.ok && jp?.friendStatus) setFriendStatus(jp.friendStatus);
      } else {
        setFriendStatus("none");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function saveRoom() {
    const r = await fetch("/api/arena/room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        backgroundUrl: editBg || null,
        avatarUrl: editAvatar || null,
        bio: editBio || null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert(j?.error || "Save failed");
      return;
    }
    setEditOpen(false);
    await loadAll();
  }

  async function createPost() {
    const r = await fetch("/api/arena/room/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: postText || null,
        imageUrl: postImage || null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert(j?.error || "Post failed");
      return;
    }
    setPostText("");
    setPostImage("");
    await loadAll();
  }

  async function addFriend() {
    if (!room?.userId) return;
    const r = await fetch("/api/arena/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: room.userId }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert(j?.error || "Failed");
      return;
    }
    setFriendStatus(j?.status === "accepted" ? "accepted" : "pending_outgoing");
  }

  return (
    <ArenaShell>
      <div className="mx-auto max-w-[1400px] px-3 md:px-6 pb-10">
        <div className="rounded-3xl border border-white/10 bg-black/35 backdrop-blur-xl overflow-hidden">
          <div
            className="relative h-[220px] md:h-[260px] border-b border-white/10"
            style={{
              backgroundImage: room?.backgroundUrl ? `url(${room.backgroundUrl})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {!room?.backgroundUrl && <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/35 to-black/60" />}
            <div className="absolute inset-0 bg-black/35" />
            <div className="relative z-10 h-full flex items-end">
              <div className="w-full p-4 md:p-6 flex items-end justify-between gap-4">
                <div className="flex items-end gap-4">
                  <div className="relative h-20 w-20 md:h-24 md:w-24 rounded-3xl overflow-hidden border border-white/15 bg-black/40">
                    {room?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={room.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-white/40 text-xs">NO AVATAR</div>
                    )}
                  </div>
                  <div className="pb-1">
                    <div className="text-white text-xl md:text-2xl font-extrabold tracking-tight">{profile?.nickname || "Player"}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <Badge>{profile ? `BeavRank: ${profile.elo}` : "BeavRank: —"}</Badge>
                      <Badge>{profile?.division || "—"}</Badge>
                      <Badge>{profile?.place ? `#${profile.place} в арене` : "#—"}</Badge>
                      <Badge>{profile ? `${profile.wins}W / ${profile.losses}L (${profile.winrate}%)` : "—"}</Badge>
                    </div>
                    {room?.bio && <div className="mt-2 text-white/80 text-sm max-w-[680px]">{room.bio}</div>}
                  </div>
                </div>

                {/* справа кнопки */}
                <div className="flex gap-2">
                  {isMe ? (
                    <button
                      type="button"
                      className="rounded-2xl px-4 py-2 bg-white/8 border border-white/10 hover:bg-white/10 text-white text-sm font-semibold inline-flex items-center gap-2"
                      onClick={() => setEditOpen(true)}
                    >
                      <Pencil className="h-4 w-4" />
                      Редактировать
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="rounded-2xl px-4 py-2 bg-white/8 border border-white/10 hover:bg-white/10 text-white text-sm font-semibold"
                        onClick={() => setDmOpen(true)}
                      >
                        Message
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "rounded-2xl px-4 py-2 border text-sm font-semibold",
                          friendStatus === "accepted"
                            ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-200"
                            : friendStatus === "pending_outgoing"
                            ? "bg-yellow-500/15 border-yellow-400/25 text-yellow-100"
                            : "bg-white/8 border-white/10 hover:bg-white/10 text-white"
                        )}
                        onClick={addFriend}
                        disabled={friendStatus === "accepted" || friendStatus === "pending_outgoing"}
                      >
                        {friendStatus === "accepted" ? "Friends" : friendStatus === "pending_outgoing" ? "Request sent" : "Add friend"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Контент: слева новый пост (только для меня), справа лента */}
          <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4">
              {isMe ? (
                <div className="rounded-3xl border border-white/10 bg-black/30 p-4 md:p-5">
                  <div className="text-white font-extrabold tracking-tight">Новый пост</div>
                  <div className="mt-1 text-white/55 text-xs">Текст + опционально фото (upload)</div>

                  <div className="mt-4 grid gap-3">
                    <Field label="Text" value={postText} onChange={setPostText} placeholder="Что нового?" textarea />
                    <ImageUploadInline label="Фото (optional)" value={postImage} onChange={setPostImage} help="Можно оставить пустым" />
                    <button
                      type="button"
                      onClick={createPost}
                      className="rounded-2xl px-4 py-2 bg-white/8 border border-white/10 hover:bg-white/10 text-white font-semibold"
                    >
                      Опубликовать
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-black/30 p-4 md:p-5 text-white/60">
                  {loading ? "Загрузка…" : "Посты игрока"}
                </div>
              )}
            </div>

            <div className="lg:col-span-8">
              <div className="rounded-3xl border border-white/10 bg-black/30 p-4 md:p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="text-white font-extrabold tracking-tight">Лента</div>
                    <div className="mt-1 text-white/55 text-xs">Посты и фотографии</div>
                  </div>
                  <div className="text-white/45 text-xs">{loading ? "loading…" : `${posts.length} posts`}</div>
                </div>

                <div className="mt-4 grid gap-4">
                  {posts.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/3 p-4 text-white/55 text-sm">Тут пока пусто.</div>
                  ) : (
                    posts.map((p) => (
                      <div key={p.id} className="rounded-3xl border border-white/10 bg-white/3 overflow-hidden">
                        <div className="p-4">
                          <div className="text-white/40 text-xs">{ts(p.createdAt)}</div>
                          {p.text && <div className="mt-2 text-white text-sm whitespace-pre-wrap">{p.text}</div>}
                        </div>
                        {p.imageUrl && (
                          <div className="relative w-full h-[260px] md:h-[340px] border-t border-white/10 bg-black/20">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.imageUrl} alt="post" className="h-full w-full object-cover" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {!isMe && room?.userId && (
          <DmModal open={dmOpen} onClose={() => setDmOpen(false)} withUserId={room.userId} withNick={profile?.nickname || null} />
        )}

        {/* ✅ Modal: Редактировать (фон/аватар/био) */}
        {editOpen && isMe ? (
          <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm grid place-items-center p-4">
            <div className="w-full max-w-[720px] rounded-3xl border border-white/10 bg-black/60 p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white font-extrabold">Редактировать комнату</div>
                  <div className="text-white/55 text-xs mt-0.5">Фон • Аватар • Bio</div>
                </div>
                <button
                  type="button"
                  className="h-10 px-3 rounded-2xl bg-white/8 border border-white/10 hover:bg-white/10 text-white/85 inline-flex items-center gap-2"
                  onClick={() => setEditOpen(false)}
                >
                  <X className="h-4 w-4" /> Close
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                <ImageUploadInline label="Фон комнаты" value={editBg} onChange={setEditBg} />
                <ImageUploadInline label="Аватар комнаты" value={editAvatar} onChange={setEditAvatar} />
                <Field label="Bio" value={editBio} onChange={setEditBio} placeholder="Коротко о себе..." textarea />

                <button
                  type="button"
                  onClick={saveRoom}
                  className="h-11 rounded-2xl bg-accent text-black font-extrabold hover:brightness-110"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ArenaShell>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 py-1 rounded-2xl bg-black/40 border border-white/10 text-white/85">{children}</div>;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <label className="grid gap-1">
      <div className="text-white/55 text-xs font-semibold">{label}</div>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[96px] resize-none rounded-2xl bg-black/25 border border-white/10 px-3 py-2 text-sm text-white/85 placeholder:text-white/30 outline-none focus:border-white/20"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="rounded-2xl bg-black/25 border border-white/10 px-3 py-2 text-sm text-white/85 placeholder:text-white/30 outline-none focus:border-white/20"
        />
      )}
    </label>
  );
}