"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { cn } from "@/components/utils/cn";

type Row = { userId: string; nickname?: string | null; createdAt?: number; updatedAt?: number };

export default function ArenaFriendsPanel() {
  const [accepted, setAccepted] = useState<Row[]>([]);
  const [incoming, setIncoming] = useState<Row[]>([]);
  const [outgoing, setOutgoing] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/arena/friends", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setAccepted(j?.accepted ?? []);
    setIncoming(j?.incoming ?? []);
    setOutgoing(j?.outgoing ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function accept(userId: string) {
    await fetch("/api/arena/friends/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    load();
  }

  async function remove(userId: string) {
    await fetch("/api/arena/friends/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    load();
  }

  return (
    <div className="rounded-3xl card-glass p-6">
      <div className="text-white text-xl font-extrabold">Friends</div>
      <div className="text-white/60 text-sm mt-1">Добавляй игроков в друзья и общайся в личке.</div>

      {loading ? (
        <div className="text-white/60 mt-4">Loading…</div>
      ) : (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Section title={`Incoming (${incoming.length})`}>
            {incoming.length === 0 ? (
              <Empty />
            ) : (
              incoming.map((u) => (
                <RowItem
                  key={u.userId}
                  nick={u.nickname || u.userId.slice(0, 6)}
                  right={
                    <div className="flex items-center gap-2">
                      <button onClick={() => accept(u.userId)} className="h-9 px-3 rounded-2xl bg-accent text-black font-bold">Accept</button>
                      <button onClick={() => remove(u.userId)} className="h-9 px-3 rounded-2xl bg-white/6 border border-white/10 text-white/80">Decline</button>
                    </div>
                  }
                />
              ))
            )}
          </Section>

          <Section title={`Friends (${accepted.length})`}>
            {accepted.length === 0 ? (
              <Empty />
            ) : (
              accepted.map((u) => (
                <RowItem
                  key={u.userId}
                  nick={u.nickname || u.userId.slice(0, 6)}
                  right={
                    <button onClick={() => remove(u.userId)} className="h-9 px-3 rounded-2xl bg-white/6 border border-white/10 text-white/80">Remove</button>
                  }
                />
              ))
            )}
          </Section>

          <Section title={`Outgoing (${outgoing.length})`}>
            {outgoing.length === 0 ? (
              <Empty />
            ) : (
              outgoing.map((u) => (
                <RowItem
                  key={u.userId}
                  nick={u.nickname || u.userId.slice(0, 6)}
                  right={
                    <button onClick={() => remove(u.userId)} className="h-9 px-3 rounded-2xl bg-white/6 border border-white/10 text-white/80">Cancel</button>
                  }
                />
              ))
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-black/20 border border-white/10 p-4">
      <div className="text-white/80 font-semibold">{title}</div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function RowItem({ nick, right }: { nick: string; right: React.ReactNode }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-2xl bg-white/6 border border-white/10 px-3 py-2")}> 
      <div className="text-white font-semibold truncate">{nick}</div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function Empty() {
  return <div className="text-white/45 text-sm">Empty</div>;
}
