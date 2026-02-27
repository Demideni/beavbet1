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

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function MobileTilesCarousel({ tiles }: { tiles: Tile[] }) {
  const count = tiles.length;

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let raf = 0;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;

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

  const snapTo = (idx: number) => {
    const el = scrollerRef.current;
    const it = itemRefs.current[idx];
    if (!el || !it) return;
    const left = it.offsetLeft - (el.clientWidth / 2 - it.clientWidth / 2);
    el.scrollTo({ left, behavior: "smooth" });
  };

  useEffect(() => {
    // initial center
    snapTo(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dots = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

  return (
    <div className="md:hidden">
      {/* hint shadow edges */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black/50 to-transparent z-20" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/50 to-transparent z-20" />

        <div
          ref={scrollerRef}
          className={cn(
            "relative w-full overflow-x-auto overflow-y-visible",
            "snap-x snap-mandatory scroll-smooth",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          )}
          style={{ paddingLeft: 18, paddingRight: 18 }}
        >
          <div className="flex items-stretch gap-4 py-3">
            {tiles.map((t, i) => {
              const dist = i - active; // -1 left, 0 center, +1 right
              const abs = Math.abs(dist);

              // scale: center 1, neighbors 0.82, others 0.7
              const scale = abs === 0 ? 1 : abs === 1 ? 0.82 : 0.7;

              // translate so neighbors "peek" behind center
              // negative -> left, positive -> right
              const translateX = dist === 0 ? 0 : dist < 0 ? 42 : -42;

              // push behind
              const zIndex = 30 - abs * 10;

              // reduce opacity for far items
              const opacity = abs === 0 ? 1 : abs === 1 ? 0.92 : 0.7;

              // slight blur for far
              const blur = abs >= 2 ? "blur-[1px]" : "";

              return (
                <div
                  key={t.key}
                  ref={(node) => {
                    itemRefs.current[i] = node;
                  }}
                  className={cn(
                    "snap-center shrink-0",
                    // width so that neighbors can peek
                    "w-[82vw] max-w-[380px]"
                  )}
                  style={{ zIndex }}
                >
                  <div
                    className={cn(
                      "transition-all duration-300 ease-out origin-center will-change-transform",
                      blur
                    )}
                    style={{
                      transform: `translateX(${translateX}px) scale(${scale})`,
                      opacity,
                    }}
                  >
                    <TileCard {...t} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="mt-2 flex items-center justify-center gap-2">
        {dots.map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to ${i + 1}`}
            onClick={() => snapTo(i)}
            className={cn(
              "h-2.5 w-2.5 rounded-full transition",
              i === active ? "bg-accent" : "bg-white/20 hover:bg-white/35"
            )}
          />
        ))}
      </div>

      {/* Tiny hint text */}
      <div className="mt-2 text-center text-white/35 text-xs">Свайпни вбок →</div>
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
            sizes="(max-width: 768px) 82vw, 380px"
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