"use client";

import { useMemo, useState } from "react";
import ArenaShell from "../ArenaShell";
import ArenaMessagesPanel from "@/components/arena/ArenaMessagesPanel";
import { cn } from "@/components/utils/cn";
import { Search } from "lucide-react";

export default function MessagesClient() {
  const [q, setQ] = useState("");

  // ВАЖНО: если ArenaMessagesPanel сам умеет поиск — отлично.
  // Если нет — пока просто визуальный поиск (следующим шагом сделаем фильтрацию по q внутри панели).
  const hint = useMemo(() => (q.trim() ? `Поиск: ${q.trim()}` : "Поиск"), [q]);

  return (
    <ArenaShell>
      <div className="mx-auto max-w-[1100px] px-3 md:px-6 py-6">
        {/* Telegram-like header */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-white text-2xl font-extrabold">Чаты</div>
          <div className="text-white/45 text-xs">INBOX</div>
        </div>

        <div className="mt-3 rounded-3xl border border-white/10 bg-black/35 backdrop-blur-xl p-3">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 h-11">
            <Search className="h-4 w-4 text-white/45" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={hint}
              className={cn("flex-1 bg-transparent outline-none text-white/85 placeholder:text-white/35")}
            />
          </div>

          <div className="mt-3">
            {/* Тут только список/диалоги */}
            <ArenaMessagesPanel />
          </div>
        </div>
      </div>
    </ArenaShell>
  );
}