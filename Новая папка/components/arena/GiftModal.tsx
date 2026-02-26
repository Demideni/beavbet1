"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/components/utils/cn";

export default function GiftModal({
  open,
  onClose,
  toUserId,
  toNick,
}: {
  open: boolean;
  onClose: () => void;
  toUserId: string;
  toNick?: string | null;
}) {
  const [amount, setAmount] = useState("5");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount("5");
    setNote("");
  }, [open]);

  const title = useMemo(() => toNick || toUserId.slice(0, 6), [toNick, toUserId]);

  async function send() {
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) return alert("Enter amount");
    setBusy(true);
    const r = await fetch("/api/arena/gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId, amount: a, currency: "EUR", note }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return alert(j?.error || "Error");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-[520px] rounded-3xl card-glass p-5 border border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="text-white font-extrabold text-lg">Gift to {title}</div>
          <button onClick={onClose} className="h-9 w-9 rounded-2xl bg-white/6 border border-white/10 text-white/80 hover:bg-white/10 inline-flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <div>
            <div className="text-white/60 text-xs mb-1">Amount (EUR)</div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={cn("w-full h-12 rounded-2xl bg-black/30 border border-white/10 px-3 text-white outline-none")}
              placeholder="5"
            />
          </div>

          <div>
            <div className="text-white/60 text-xs mb-1">Note (optional)</div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={cn("w-full h-12 rounded-2xl bg-black/30 border border-white/10 px-3 text-white outline-none")}
              placeholder="GG, thanks!"
            />
          </div>

          <button
            disabled={busy}
            onClick={send}
            className={cn(
              "h-12 rounded-2xl bg-accent text-black font-extrabold",
              busy ? "opacity-70" : "hover:brightness-110"
            )}
          >
            {busy ? "Sending…" : "Send gift"}
          </button>

          <div className="text-white/45 text-xs">
            MVP: gift transfers EUR from your wallet to the player instantly.
          </div>
        </div>
      </div>
    </div>
  );
}
