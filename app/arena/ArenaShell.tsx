"use client";

import { ReactNode } from "react";

export default function ArenaShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[calc(100vh-72px)]">
      <div className="cs2-shell-bg" aria-hidden />
      <div className="cs2-fx" aria-hidden>
        <div className="cs2-glow" />
        <div className="cs2-scanlines" />
        <div className="cs2-noise" />
        <div className="cs2-vignette" />
      </div>

      <div className="cs2-wrap">{children}</div>
    </div>
  );
}
