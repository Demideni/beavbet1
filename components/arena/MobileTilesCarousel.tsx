"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/components/utils/cn";

type Tile = {
  key: string;
  title: string;
  subtitle: string;
  href: string;
  bgSrc: string;
};

function useCenterIndex(count: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let raf = 0;

    const compute = () => {
      const cRect = el.getBoundingClientRect();
      const centerX = cRect.left + cRect.width / 2;

      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;

      for (let i = 0; i < count; i++) {
        const it = itemRefs.current[i];
        if (!it) continue;
        const r = it.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const d = Math.abs(x - centerX);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      setActive(best);
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };

    compute();
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => compute());
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [count]);

  return { containerRef, itemRefs, active, setActive };
}

export default function MobileTilesCarousel({ tiles }: { tiles: Tile[] }) {
  const count = tiles.length;
  const { containerRef, itemRefs, active, setActive } = useCenterIndex(count);

  const paddingPx = 18;

  const snapTo = (idx: number) => {
    const el = containerRef.current;
    const it = itemRefs.current[idx];
    if (!el || !it) return;

    const left = it.offsetLeft - (el.clientWidth / 2 - it.clientWidth / 2);
    el.scrollTo({ left, behavior: "smooth" });
  };

  useEffect(() => {
    // На старте центрируем 1-ую карточку (0 индекс)
    snapTo(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dots = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

  return (
    <div className="md:hidden">
      <div
        ref={containerRef}
        className={cn(
          "relative w-full overflow-x-auto overflow-y-hidden",
          "snap-x snap-mandatory scroll-smooth",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
        style={{ paddingLeft: paddingPx, paddingRight: paddingPx }}
      >
        <div className="flex items-stretch gap-4 py-2">
          {tiles.map((t, i) => {
            const isActive = i === active;
            return (
              <div
                key={t.key}
                ref={(node) => {
                  itemRefs.current[i] = node;
                }}
                className={cn(
                  "snap-center shrink-0",
                  // ширина под мобилку, чтобы центрирование было красивым
                  "w-[78vw] max-w-[360px]"
                )}
              >
                <div
                  className={cn(
                    "transition-transform duration-300 ease-out origin-center",
                    isActive ? "scale-100" : "scale-[0.5]"
                  )}
                >
                  <TileCard {...t} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dots */}
      <div className="mt-2 flex items-center justify-center gap-2">
        {dots.map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to ${i + 1}`}
            onClick={() => {
              setActive(i);
              snapTo(i);
            }}
            className={cn(
              "h-2.5 w-2.5 rounded-full transition",
              i === active ? "bg-accent" : "bg-white/20 hover:bg-white/35"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function TileCard({ title, subtitle, href, bgSrc }: Tile) {
  const isHash = href.startsWith("#");

  const content = (
    <div className="group relative block rounded-3xl overflow-hidden">
      {/* Glow */}
      <div
        className="pointer-events-none absolute -inset-1 rounded-[28px] opacity-0 group-hover:opacity-100 transition duration-500 blur-2xl
        bg-[radial-gradient(circle_at_20%_30%,rgba(255,70,60,0.55),transparent_55%),
             radial-gradient(circle_at_80%_20%,rgba(255,180,60,0.35),transparent_55%),
             radial-gradient(circle_at_50%_85%,rgba(255,70,60,0.25),transparent_55%)]"
      />

      <div className="relative rounded-3xl bg-black/25 border border-white/10 hover:border-white/15 overflow-hidden transition">
        <div className="h-[130px] relative">
          <Image
            src={bgSrc}
            alt=""
            fill
            className="object-cover opacity-90 group-hover:opacity-100 transition"
            sizes="(max-width: 768px) 78vw, 360px"
            priority={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition">
            <div className="absolute -left-1/3 top-0 h-full w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-accent/90 h-1" />
        </div>

        <div className="p-4">
          <div className="text-white font-extrabold">{title}</div>
          <div className="text-white/60 text-sm mt-1">{subtitle}</div>
        </div>
      </div>
    </div>
  );

  if (isHash) return <a href={href}>{content}</a>;
  return <Link href={href}>{content}</Link>;
}