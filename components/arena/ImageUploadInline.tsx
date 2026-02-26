"use client";

import { useRef, useState } from "react";
import { cn } from "@/components/utils/cn";

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  help?: string;
  className?: string;
  /** If true, shows a small read-only input with the resulting URL (useful for debugging/copy). */
  showUrl?: boolean;
};

export default function ImageUploadInline({ label, value, onChange, help, className, showUrl }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setErr(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Только изображения (jpg/png/webp/gif)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErr("Слишком большой файл (макс 10MB)");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const r = await fetch("/api/arena/uploads/image", {
        method: "POST",
        body: form,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "UPLOAD_FAILED");
      if (typeof j?.url !== "string") throw new Error("BAD_RESPONSE");

      onChange(j.url);
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="text-white/55 text-xs font-semibold">{label}</div>

      <div className={cn("rounded-3xl bg-black/20 border border-white/10 p-3", "flex items-center gap-3")}>
        <div className="relative h-12 w-12 rounded-2xl overflow-hidden border border-white/10 bg-black/30">
          {value ? (
            // Use <img> so authenticated /api/arena/uploads/* works (Next/Image optimizer won't forward cookies).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="preview" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full grid place-items-center text-white/35 text-[10px]">NO IMG</div>
          )}
        </div>

        <div className="flex-1">
          <div className="text-white/85 text-sm font-semibold">{busy ? "Загрузка…" : "Загрузить"}</div>
          <div className="text-white/45 text-xs mt-0.5">jpg/png/webp/gif • до 10MB</div>
          {help ? <div className="text-white/35 text-[11px] mt-1">{help}</div> : null}
          {err ? <div className="text-red-300 text-[11px] mt-1">{err}</div> : null}
        </div>

        <button
          type="button"
          className={cn(
            "h-10 px-4 rounded-2xl",
            "bg-white/8 border border-white/10 hover:bg-white/10",
            "text-white font-semibold",
            busy ? "opacity-70" : ""
          )}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Upload
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) await upload(f);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {showUrl ? (
        <input
          readOnly
          value={value}
          className="h-10 rounded-2xl bg-black/25 border border-white/10 px-3 text-xs text-white/70 outline-none"
        />
      ) : null}
    </div>
  );
}