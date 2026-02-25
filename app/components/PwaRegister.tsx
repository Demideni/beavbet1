"use client";

import { useEffect } from "react";

/**
 * Registers a minimal Service Worker so the site becomes installable as a PWA
 * (desktop: runs in standalone window without browser tabs).
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Register once; ignore failures (e.g. http in dev).
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {});
  }, []);

  return null;
}
