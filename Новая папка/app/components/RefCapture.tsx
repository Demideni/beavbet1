"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function RefCapture() {
  const params = useSearchParams();

  useEffect(() => {
    const ref = params.get("ref");
    if (!ref) return;
    const code = ref.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,32}$/.test(code)) return;

    // Fire-and-forget: record click and set cookie on server
    fetch("/api/affiliate/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code }),
    }).catch(() => {});
  }, [params]);

  return null;
}
