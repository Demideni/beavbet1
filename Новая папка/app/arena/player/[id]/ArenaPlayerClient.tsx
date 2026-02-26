"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ArenaShell from "../../ArenaShell";
import { ChevronLeft, MessageCircle, UserPlus, Gift } from "lucide-react";
import { cn } from "@/components/utils/cn";
import DmModal from "@/components/arena/DmModal";
import GiftModal from "@/components/arena/GiftModal";

type Profile = {
  userId: string;
  nickname: string | null;
  avatarUrl?: string | null;
  elo: number;
  division: string;
  matches: number;
  wins: number;
  losses: number;
  winrate: number;
};

export default function ArenaPlayerClient({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friendStatus, setFriendStatus] = useState<string>("none");
  const [dmOpen, setDmOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/arena/player?id=${encodeURIComponent(userId)}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setProfile(j?.profile ?? null);
    setFriendStatus(j?.friendStatus ?? "none");
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const title = useMemo(() => {
    if (!profile) return "Player";
    return profile.nickname || profile.userId.slice(0, 6);
  }, [profile]);

  async function addFriend() {
    const r = await fetch("/api/arena/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: userId }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return alert(j?.error || "Error");
    setFriendStatus(j?.status === "accepted" ? "accepted" : "pending_outgoing");
  }

  async function acceptFriend() {
    const r = await fetch("/api/arena/friends/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return alert(j?.error || "Error");
    setFriendStatus("accepted");
  }

  return (
    <ArenaShell>
      <div className="mx-auto max-w-[1000px] px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <Link href="/arena" className="inline-flex items-center gap-2 text-white/80 hover:text-white">
            <ChevronLeft className="h-4 w-4" /> Back to Arena
          </Link>
          <Link href="/arena/profile" className="text-white/80 hover:text-white">My profile →</Link>
        </div>

        <div className="mt-6 rounded-3xl card-glass p-6">
          {loading ? (
            <div className="text-white/60">Loading…</div>
          ) : !profile ? (
            <div className="text-white/60">Not found</div>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-3xl bg-white/6 border border-white/10 overflow-hidden flex items-center justify-center">
                  {profile.avatarUrl ? (
                    <Image src={profile.avatarUrl} alt={title} width={64} height={64} className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-white/40 font-extrabold">{(title || "P").slice(0, 1).toUpperCase()}</div>
                  )}
                </div>
                <div>
                  <div className="text-white text-2xl font-extrabold">{title}</div>
                  <div className="text-white/60 mt-1">
                    <span className="inline-flex items-center gap-2">
                      <Image src="/brand/beavrank.png" alt="BeavRank" width={14} height={14} className="opacity-90" />
                      BeavRank: <span className="text-white font-bold">{profile.elo}</span> • {profile.division}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setDmOpen(true)}
                  className={cn("h-11 px-4 rounded-2xl bg-white/6 border border-white/10 text-white/90 hover:bg-white/10 inline-flex items-center gap-2")}
                >
                  <MessageCircle className="h-4 w-4" /> Message
                </button>

                <button
                  onClick={() => setGiftOpen(true)}
                  className={cn("h-11 px-4 rounded-2xl bg-white/6 border border-white/10 text-white/90 hover:bg-white/10 inline-flex items-center gap-2")}
                >
                  <Gift className="h-4 w-4" /> Gift
                </button>

                {friendStatus === "accepted" ? (
                  <div className="h-11 px-4 rounded-2xl bg-accent/20 border border-accent/30 text-accent font-bold inline-flex items-center">
                    Friends
                  </div>
                ) : friendStatus === "pending_outgoing" ? (
                  <div className="h-11 px-4 rounded-2xl bg-white/6 border border-white/10 text-white/70 inline-flex items-center">
                    Request sent
                  </div>
                ) : friendStatus === "pending_incoming" ? (
                  <button
                    onClick={acceptFriend}
                    className="h-11 px-4 rounded-2xl bg-accent text-black font-extrabold inline-flex items-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" /> Accept friend
                  </button>
                ) : (
                  <button
                    onClick={addFriend}
                    className="h-11 px-4 rounded-2xl bg-accent text-black font-extrabold inline-flex items-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" /> Add friend
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {profile ? (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Matches" value={String(profile.matches)} />
            <Stat label="Winrate" value={`${profile.winrate}%`} />
            <Stat label="Wins" value={String(profile.wins)} />
            <Stat label="Losses" value={String(profile.losses)} />
          </div>
        ) : null}
      </div>

      <DmModal open={dmOpen} onClose={() => setDmOpen(false)} withUserId={userId} withNick={profile?.nickname} />
      <GiftModal open={giftOpen} onClose={() => setGiftOpen(false)} toUserId={userId} toNick={profile?.nickname} />
    </ArenaShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-black/20 border border-white/10 p-4">
      <div className="text-white/55 text-xs">{label}</div>
      <div className="text-white font-extrabold text-xl mt-1">{value}</div>
    </div>
  );
}
