"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ArenaShell from "../ArenaShell";
import { cn } from "@/components/utils/cn";

type MyClan = {
  id: string;
  name: string;
  tag?: string | null;
  ownerId: string;
  avatarUrl?: string | null;
  createdAt: number;
  myRole: "owner" | "admin" | "member";
} | null;

type Invite = {
  id: string;
  clanId: string;
  clanName: string;
  clanTag?: string | null;
  invitedByUserId: string;
  invitedByNick?: string | null;
  status: string;
  createdAt: number;
};

export default function ClansClient() {
  const [loading, setLoading] = useState(true);
  const [myClan, setMyClan] = useState<MyClan>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/arena/clans", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setMyClan(j?.myClan ?? null);
    setInvites(Array.isArray(j?.invites) ? j.invites : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    const n = name.trim();
    if (n.length < 3) return alert("Clan name too short");
    setBusy(true);
    const r = await fetch("/api/arena/clans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n, tag: tag.trim(), avatarUrl: avatarUrl.trim() }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return alert(j?.error || "Error");
    setName("");
    setTag("");
    setAvatarUrl("");
    load();
  }

  async function respond(inviteId: string, action: "accept" | "decline") {
    setBusy(true);
    const r = await fetch("/api/arena/clans/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, inviteId }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return alert(j?.error || "Error");
    load();
  }

  return (
    <ArenaShell>
      <div className="mx-auto max-w-[900px]">
        <div className="flex items-center justify-between gap-3">
          <Link href="/arena" className="text-white/80 hover:text-white">
            ← Back to Arena
          </Link>
          <Link href="/arena/profile" className="text-white/80 hover:text-white">
            Profile →
          </Link>
        </div>

        <div className="mt-6 rounded-3xl card-glass p-6">
          <div className="text-white text-2xl font-extrabold">Clans</div>
          <div className="text-white/60 mt-1">Create a clan, accept invites, and play under one tag.</div>

          {loading ? (
            <div className="text-white/60 mt-4">Loading…</div>
          ) : myClan ? (
            <div className="mt-4 rounded-3xl bg-white/6 border border-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white font-extrabold text-lg">
                    {myClan.name} {myClan.tag ? <span className="text-white/50">[{myClan.tag}]</span> : null}
                  </div>
                  <div className="text-white/50 text-sm">Your role: {myClan.myRole}</div>
                </div>
                <div className="text-white/40 text-xs">MVP • invites & chat next</div>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <div className="text-white font-extrabold">Create your clan</div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Clan name (unique)"
                  className="h-11 rounded-2xl bg-white/6 border border-white/10 px-3 text-white outline-none"
                />
                <input
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Tag (2–6)"
                  className="h-11 rounded-2xl bg-white/6 border border-white/10 px-3 text-white outline-none"
                />
                <input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="Avatar URL (optional)"
                  className="h-11 rounded-2xl bg-white/6 border border-white/10 px-3 text-white outline-none"
                />
              </div>
              <button
                onClick={create}
                disabled={busy}
                className={cn(
                  "mt-3 h-11 px-4 rounded-2xl bg-accent text-black font-extrabold",
                  busy ? "opacity-70" : "hover:brightness-110"
                )}
              >
                Create clan
              </button>
            </div>
          )}

          {invites.length > 0 ? (
            <div className="mt-6">
              <div className="text-white font-extrabold">Invites</div>
              <div className="mt-3 space-y-2">
                {invites.map((i) => (
                  <div key={i.id} className="rounded-3xl bg-white/6 border border-white/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-white font-extrabold">
                          {i.clanName} {i.clanTag ? <span className="text-white/50">[{i.clanTag}]</span> : null}
                        </div>
                        <div className="text-white/50 text-sm">
                          Invited by {i.invitedByNick || i.invitedByUserId.slice(0, 6)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={busy}
                          onClick={() => respond(i.id, "decline")}
                          className="h-10 px-3 rounded-2xl bg-white/6 border border-white/10 text-white/85 hover:bg-white/10"
                        >
                          Decline
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => respond(i.id, "accept")}
                          className="h-10 px-3 rounded-2xl bg-accent text-black font-extrabold hover:brightness-110"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </ArenaShell>
  );
}
