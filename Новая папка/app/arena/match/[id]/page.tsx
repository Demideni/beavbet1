"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ArenaShell from "../../ArenaShell";
import { useParams } from "next/navigation";
import { cn } from "@/components/utils/cn";

function CopyRow({ label, value }: { label: string; value: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      alert("Скопировано");
    } catch {
      alert(value);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/20 border border-white/10 px-4 py-3">
      <div className="min-w-0">
        <div className="text-white/50 text-xs">{label}</div>
        <div className="text-white/90 text-sm font-mono truncate">{value}</div>
      </div>
      <button onClick={copy} className="shrink-0 px-3 py-2 rounded-xl cs2-btn-ghost text-xs text-white/85">
        Copy
      </button>
    </div>
  );
}

export default function ArenaMatchPage() {
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [match, setMatch] = useState<any>(null);
  const [busy, setBusy] = useState<"win" | "lose" | null>(null);
  const [readyBusy, setReadyBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/arena/my-matches", {
      cache: "no-store",
      credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    const found = (j?.matches ?? []).find((x: any) => x.id === id);
    setMatch(found || null);
  }

  useEffect(() => {
    if (!id) return;
    load();
    const t = setInterval(() => load(), 5000);
    return () => clearInterval(t);
  }, [id]);

  async function report(result: "win" | "lose") {
    setBusy(result);
    const r = await fetch("/api/arena/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: id, result }),
      credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) {
      alert(j?.error || "Ошибка");
      return;
    }
    await load();
  }

  async function setReady(ready: boolean) {
    setReadyBusy(true);
    const r = await fetch("/api/arena/ready", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: id, ready }),
      credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    setReadyBusy(false);
    if (!r.ok) {
      alert(j?.error || "Ошибка");
      return;
    }
    await load();
  }

  const joinLink = useMemo(() => {
    const v = match?.join_link;
    if (!v) return null;
    return String(v);
  }, [match]);

  if (!match) {
    return (
      <ArenaShell>
        <div className="mx-auto max-w-[980px] px-4 py-6 text-white/60">
          Матч не найден (или ты не участник).
          <div className="mt-4">
            <Link href="/arena/matches" className="px-4 py-2 rounded-2xl cs2-btn-ghost text-sm text-white/85">
              Назад
            </Link>
          </div>
        </div>
      </ArenaShell>
    );
  }

  return (
    <ArenaShell>
      <div className="mx-auto max-w-[980px] px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-white text-2xl font-extrabold">Match Room</div>
            <div className="mt-1 text-white/60 text-sm">
              {match.game} • {match.title} • Round {match.round}
            </div>
          </div>
          <Link href="/arena/matches" className="px-4 py-2 rounded-2xl cs2-btn-ghost text-sm text-white/85">
            Мои матчи
          </Link>
        </div>

        <div className="mt-6 rounded-3xl cs2-panel-dark p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-white/85 font-semibold">
              {match.p1_nick || match.p1_user_id?.slice(0, 6)} vs {match.p2_nick || match.p2_user_id?.slice(0, 6)}
            </div>
            <div className="text-white/45 text-sm">Status: {match.status}</div>
          </div>

          <div className="mt-4 grid gap-3">
            {match.server ? <CopyRow label="Server" value={String(match.server)} /> : null}
            {match.server_password ? <CopyRow label="Password" value={String(match.server_password)} /> : null}
            {joinLink ? <CopyRow label="Join" value={joinLink} /> : null}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setReady(true)}
              disabled={readyBusy}
              className={cn("px-4 py-2 rounded-2xl text-sm font-semibold", "btn-accent", readyBusy && "opacity-70")}
            >
              {readyBusy ? "…" : "READY"}
            </button>
            <button
              onClick={() => setReady(false)}
              disabled={readyBusy}
              className="px-4 py-2 rounded-2xl cs2-btn-ghost text-sm text-white/85 disabled:opacity-60"
            >
              Not ready
            </button>
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="text-white/70 text-sm font-semibold">Репорт результата</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => report("win")}
                disabled={busy === "win"}
                className="px-4 py-2 rounded-2xl bg-white/10 border border-white/15 text-white hover:bg-white/15 disabled:opacity-60"
              >
                {busy === "win" ? "…" : "Я выиграл"}
              </button>
              <button
                onClick={() => report("lose")}
                disabled={busy === "lose"}
                className="px-4 py-2 rounded-2xl bg-white/10 border border-white/15 text-white hover:bg-white/15 disabled:opacity-60"
              >
                {busy === "lose" ? "…" : "Я проиграл"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ArenaShell>
  );
}
