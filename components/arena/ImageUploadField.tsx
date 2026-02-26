"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/components/utils/cn";

type UploadKind = "avatar" | "room-bg" | "post";

type Props = {
  kind: UploadKind;
  label: string;
  value: string;
  onChange: (url: string) => void;
  help?: string;
  // allow user to still paste URL if they want
  allowUrlPaste?: boolean;
  placeholderUrl?: string;
};

type CropSpec = {
  aspect: number; // w/h
  outW: number;
  outH: number;
  maxDim: number; // client-side resize before crop
  quality: number; // webp 0..1
};

function specFor(kind: UploadKind): CropSpec {
  if (kind === "avatar") return { aspect: 1, outW: 512, outH: 512, maxDim: 1024, quality: 0.86 };
  if (kind === "room-bg") return { aspect: 16 / 9, outW: 1600, outH: 900, maxDim: 2200, quality: 0.86 };
  return { aspect: 16 / 9, outW: 1600, outH: 900, maxDim: 2200, quality: 0.86 };
}

async function fileToImageBitmap(file: File): Promise<ImageBitmap> {
  return await createImageBitmap(file);
}

async function downscaleToMax(bitmap: ImageBitmap, maxDim: number): Promise<HTMLCanvasElement> {
  const w = bitmap.width;
  const h = bitmap.height;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const c = document.createElement("canvas");
  c.width = tw;
  c.height = th;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("NO_CTX");
  ctx.drawImage(bitmap, 0, 0, tw, th);
  return c;
}

async function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) reject(new Error("TO_BLOB_FAILED"));
        else resolve(b);
      },
      "image/webp",
      quality
    );
  });
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function ImageUploadField({
  kind,
  label,
  value,
  onChange,
  help,
  allowUrlPaste = true,
  placeholderUrl = "https://...",
}: Props) {
  const spec = useMemo(() => specFor(kind), [kind]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [cropOpen, setCropOpen] = useState(false);
  const [cropSource, setCropSource] = useState<{ canvas: HTMLCanvasElement; previewUrl: string } | null>(null);

  // Crop controls
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0); // -1..1 (relative)
  const [panY, setPanY] = useState(0);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const onPickFile = useCallback(
    async (file: File) => {
      setErr(null);
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setErr("Только изображения (jpg/png/webp)");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setErr("Слишком большой файл (макс 10MB)");
        return;
      }
      setBusy(true);
      try {
        const bmp = await fileToImageBitmap(file);
        const base = await downscaleToMax(bmp, spec.maxDim);

        // Create a preview url from the (downscaled) canvas for smooth UI
        const previewBlob = await canvasToWebpBlob(base, 0.92);
        const previewUrl = URL.createObjectURL(previewBlob);
        setCropSource({ canvas: base, previewUrl });
        setZoom(1);
        setPanX(0);
        setPanY(0);
        setCropOpen(true);
      } catch {
        setErr("Не удалось прочитать изображение");
      } finally {
        setBusy(false);
      }
    },
    [spec.maxDim]
  );

  const uploadCropped = useCallback(async () => {
    if (!cropSource) return;
    setBusy(true);
    setErr(null);
    try {
      const src = cropSource.canvas;
      const out = document.createElement("canvas");
      out.width = spec.outW;
      out.height = spec.outH;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("NO_CTX");

      const srcW = src.width;
      const srcH = src.height;
      const srcAspect = srcW / srcH;

      // viewport (crop area in source pixels)
      let viewW: number;
      let viewH: number;
      if (srcAspect >= spec.aspect) {
        // source is wider than target => height dictates
        viewH = srcH / zoom;
        viewW = viewH * spec.aspect;
      } else {
        // source is taller than target => width dictates
        viewW = srcW / zoom;
        viewH = viewW / spec.aspect;
      }

      // panX/panY are -1..1 relative to remaining space
      const maxPanX = Math.max(0, (srcW - viewW) / 2);
      const maxPanY = Math.max(0, (srcH - viewH) / 2);
      const cx = srcW / 2 + panX * maxPanX;
      const cy = srcH / 2 + panY * maxPanY;

      const sx = clamp(cx - viewW / 2, 0, srcW - viewW);
      const sy = clamp(cy - viewH / 2, 0, srcH - viewH);

      ctx.drawImage(src, sx, sy, viewW, viewH, 0, 0, spec.outW, spec.outH);
      const blob = await canvasToWebpBlob(out, spec.quality);

      const form = new FormData();
      form.append("file", new File([blob], `${kind}.webp`, { type: "image/webp" }));

      const res = await fetch(`/api/upload/${kind}`, { method: "POST", body: form });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "UPLOAD_FAILED");
      if (typeof j?.url !== "string") throw new Error("BAD_RESPONSE");

      onChange(j.url);
      setCropOpen(false);
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  }, [cropSource, kind, onChange, panX, panY, spec, zoom]);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) await onPickFile(file);
    },
    [onPickFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const cropFrameRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ active: boolean; x: number; y: number; panX: number; panY: number }>({
    active: false,
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!cropFrameRef.current) return;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      dragState.current = { active: true, x: e.clientX, y: e.clientY, panX, panY };
    },
    [panX, panY]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!cropFrameRef.current) return;
    if (!dragState.current.active) return;
    const rect = cropFrameRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragState.current.x) / rect.width;
    const dy = (e.clientY - dragState.current.y) / rect.height;
    setPanX(clamp(dragState.current.panX - dx * 2, -1, 1));
    setPanY(clamp(dragState.current.panY - dy * 2, -1, 1));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragState.current.active = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  return (
    <div className="grid gap-2">
      <div className="text-white/60 text-xs font-semibold">{label}</div>

      <div
        onClick={openPicker}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        role="button"
        tabIndex={0}
        className={cn(
          "group rounded-3xl border border-white/10 bg-black/25 p-3 cursor-pointer select-none",
          dragOver ? "ring-2 ring-white/30" : "hover:bg-black/30"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 rounded-2xl overflow-hidden border border-white/10 bg-black/30">
            {value ? (
              <Image src={value} alt="preview" fill className="object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center text-white/35 text-[10px]">NO IMG</div>
            )}
          </div>
          <div className="flex-1">
            <div className="text-white/90 text-sm font-semibold">Загрузить картинку</div>
            <div className="text-white/45 text-xs mt-0.5">Перетащи сюда или кликни • jpg/png/webp</div>
            {help ? <div className="text-white/35 text-[11px] mt-1">{help}</div> : null}
          </div>
          <div className={cn("text-white/50 text-xs", busy ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
            {busy ? "…" : "edit"}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await onPickFile(f);
          e.currentTarget.value = "";
        }}
      />

      {allowUrlPaste ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 rounded-2xl bg-black/30 border border-white/10 px-3 text-white/85 placeholder:text-white/25 outline-none"
          placeholder={placeholderUrl}
        />
      ) : null}

      {err ? <div className="text-red-300 text-xs">{err}</div> : null}

      {cropOpen && cropSource ? (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-[720px] rounded-3xl border border-white/10 bg-black/60 p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-white font-extrabold">Обрезка</div>
                <div className="text-white/55 text-xs mt-0.5">Потяни картинку мышью • Zoom для приближения</div>
              </div>
              <button
                type="button"
                className="h-10 px-3 rounded-2xl bg-white/8 border border-white/10 hover:bg-white/10 text-white/85"
                onClick={() => setCropOpen(false)}
                disabled={busy}
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              <div
                ref={cropFrameRef}
                className={cn("relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40")}
                style={{ aspectRatio: `${spec.aspect}` }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cropSource.previewUrl}
                  alt="crop"
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    transform: `translate(${panX * 10}%, ${panY * 10}%) scale(${zoom})`,
                    transformOrigin: "center",
                    cursor: "grab",
                  }}
                />
                <div className="absolute inset-0 pointer-events-none ring-1 ring-white/10" />
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <div className="text-white/55 text-xs font-semibold">Zoom</div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="h-11 px-4 rounded-2xl bg-white/8 border border-white/10 hover:bg-white/10 text-white font-semibold"
                  onClick={() => {
                    setZoom(1);
                    setPanX(0);
                    setPanY(0);
                  }}
                  disabled={busy}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="h-11 px-4 rounded-2xl bg-accent text-black font-extrabold hover:brightness-110 disabled:opacity-70"
                  onClick={uploadCropped}
                  disabled={busy}
                >
                  {busy ? "Uploading…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}