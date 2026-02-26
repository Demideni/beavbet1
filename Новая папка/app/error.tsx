"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log for debugging in production
    // eslint-disable-next-line no-console
    console.error("Global app error:", error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-[#05080f] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-[720px] rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="text-2xl font-extrabold">Что-то сломалось 😵‍💫</div>
          <div className="mt-2 text-white/70">
            Открой DevTools → Console и пришли мне верхнюю ошибку/stack — я починю точечно.
          </div>

          <div className="mt-4 rounded-2xl bg-black/50 border border-white/10 p-4 text-sm whitespace-pre-wrap break-words text-white/80">
            {String(error?.message || "Unknown error")}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reset()}
              className="px-4 py-2 rounded-2xl bg-accent text-black font-extrabold"
            >
              Перезагрузить
            </button>
            <a
              href="/"
              className="px-4 py-2 rounded-2xl bg-white/10 border border-white/10 text-white/90 font-semibold"
            >
              На главную
            </a>
          </div>

          {error?.digest ? (
            <div className="mt-3 text-white/40 text-xs">Digest: {error.digest}</div>
          ) : null}
        </div>
      </body>
    </html>
  );
}
