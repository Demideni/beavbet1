"use client";

import React, { forwardRef, useCallback, useMemo, useRef } from "react";
import { playShutter } from "@/lib/sfx";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  /**
   * If true, plays the shutter sound on hover (after audio is unlocked by first user gesture).
   * Click always tries to play.
   */
  sound?: boolean;
};

const base =
  "group relative inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-2xl border px-4 py-2.5 font-extrabold tracking-wide transition-[transform,box-shadow,background-color,border-color,color] duration-200 active:scale-[0.985] disabled:opacity-60 disabled:cursor-not-allowed";

const sizes: Record<NonNullable<Props["size"]>, string> = {
  sm: "text-xs px-3 py-2 rounded-xl",
  md: "text-sm px-4 py-2.5 rounded-2xl",
  lg: "text-base px-5 py-3 rounded-2xl",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-black border-accent shadow-[0_0_0_0_rgba(0,0,0,0)] hover:shadow-[0_0_0_2px_rgba(255,255,255,0.08)]",
  secondary:
    "bg-white/6 text-white/90 border-white/12 hover:bg-white/10 hover:border-accent/50 hover:shadow-[0_0_0_2px_rgba(255,255,255,0.06)]",
  ghost:
    "bg-transparent text-white/85 border-white/10 hover:bg-white/6 hover:border-accent/35",
  danger:
    "bg-red-500/90 text-black border-red-400 hover:bg-red-500",
};

/**
 * Faceit-inspired button:
 * - side panels slide in from left/right on hover
 * - crisp border + glow
 * - optional shutter sound
 */
export const FaceitButton = forwardRef<HTMLButtonElement, Props>(function FaceitButton(
  { className = "", variant = "secondary", size = "md", sound = true, onMouseEnter, onClick, ...rest },
  ref
) {
  const hoverCooldown = useRef<number>(0);

  const onEnter = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onMouseEnter?.(e);
      if (!sound) return;
      const now = Date.now();
      if (now - hoverCooldown.current < 120) return;
      hoverCooldown.current = now;
      playShutter({ kind: "hover" });
    },
    [onMouseEnter, sound]
  );

  const onBtnClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (!sound) return;
      playShutter({ kind: "click" });
    },
    [onClick, sound]
  );

  const cls = useMemo(() => {
    return [base, sizes[size], variants[variant], "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70", className]
      .filter(Boolean)
      .join(" ");
  }, [className, size, variant]);

  return (
    <button ref={ref} className={cls} onMouseEnter={onEnter} onClick={onBtnClick} {...rest}>
      {/* sliding side panels */}
      <span
        aria-hidden
        className={
          "pointer-events-none absolute inset-y-0 left-0 w-[52%] -translate-x-[105%] skew-x-[-12deg] bg-white/10 transition-transform duration-200 group-hover:translate-x-[-8%]"
        }
      />
      <span
        aria-hidden
        className={
          "pointer-events-none absolute inset-y-0 right-0 w-[52%] translate-x-[105%] skew-x-[-12deg] bg-black/25 transition-transform duration-200 group-hover:translate-x-[8%]"
        }
      />

      {/* subtle top highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15"
      />

      <span className="relative z-10">{rest.children}</span>
    </button>
  );
});
