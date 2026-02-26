"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/components/utils/cn";

// Minimal typing for the deferred prompt event.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaActions({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isFs, setIsFs] = useState(false);

  const canFullscreen = useMemo(() => {
    if (typeof document === "undefined") return false;
    return !!document.documentElement?.requestFullscreen;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateInstalled = () => {
      const mm = window.matchMedia?.("(display-mode: standalone)");
      const standalone = (mm && mm.matches) || (window.navigator as any).standalone;
      setInstalled(!!standalone);
    };

    updateInstalled();

    const onBip = (e: Event) => {
      // Chrome/Edge
      e.preventDefault?.();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    const onFsChange = () => {
      setIsFs(!!document.fullscreenElement);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", updateInstalled);
    document.addEventListener("fullscreenchange", onFsChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", updateInstalled);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, []);

  const btnBase =
    "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-extrabold tracking-wide border transition-colors";

  const onInstall = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      // Prompt can be used only once
      setDeferred(null);
    }
  };

  const onToggleFs = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {!installed && deferred && (
        <button
          type="button"
          onClick={onInstall}
          className={cn(
            btnBase,
            "bg-white/7 border-white/12 text-white/90 hover:bg-white/10 hover:border-white/18"
          )}
          title="Установить Arena как приложение"
        >
          <Download className="h-4 w-4" />
          УСТАНОВИТЬ
        </button>
      )}

      {canFullscreen && (
        <button
          type="button"
          onClick={onToggleFs}
          className={cn(
            btnBase,
            "bg-accent text-black border-black/10 hover:bg-accent/90"
          )}
          title={isFs ? "Выйти из полного экрана" : "Полный экран"}
        >
          {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {isFs ? "ВЫЙТИ" : "ПОЛНЫЙ ЭКРАН"}
        </button>
      )}
    </div>
  );
}
