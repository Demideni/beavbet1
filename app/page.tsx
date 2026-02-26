"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  // Autoredirect (can be cancelled)
  const initialSeconds = 4;
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);
  const [cancelled, setCancelled] = useState<boolean>(false);

  const redirectAtZero = useMemo(() => !cancelled && secondsLeft <= 0, [cancelled, secondsLeft]);

  useEffect(() => {
    if (cancelled) return;

    const t = window.setInterval(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);

    return () => window.clearInterval(t);
  }, [cancelled]);

  useEffect(() => {
    if (redirectAtZero) router.push("/arena");
  }, [redirectAtZero, router]);

  // Any interaction cancels autoredirect (feels less “pushy”)
  useEffect(() => {
    const cancel = () => setCancelled(true);
    window.addEventListener("pointerdown", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    window.addEventListener("wheel", cancel, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("wheel", cancel);
    };
  }, []);

  return (
    <main className="relative w-full h-[100svh] overflow-hidden">
      {/* Background Video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover z-0 landingVideo"
      >
        <source src="/videos/cs2-bg.mp4" type="video/mp4" />
      </video>

      {/* Vignette + gradient overlays */}
      <div className="absolute inset-0 z-10 landingVignette" />
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/35 via-black/45 to-black/70" />

      {/* Center content */}
      <div className="relative z-20 flex items-center justify-center h-full px-6">
        <div className="w-full max-w-3xl text-center">
          {/* Brand */}
          <div className="mx-auto mb-8 flex flex-col items-center gap-4 select-none">
            <div className="relative landingGlow rounded-[28px] p-4">
              <Image
                src="/brand/logo-mark.png"
                alt="BeavBet"
                width={92}
                height={92}
                priority
                className="landingFloat"
              />
            </div>
            <div className="text-white/90">
              <div className="text-3xl md:text-4xl font-extrabold tracking-tight">
                BeavBet <span className="text-white/70">Arena</span>
              </div>
              <div className="mt-1 text-sm md:text-base text-white/60">
                CS2 • турниры • дуэли • BeavRank
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/arena"
              className="landingBtn inline-flex items-center justify-center rounded-2xl px-10 py-5 text-xl md:text-2xl font-extrabold text-white shadow-2xl"
            >
              Перейти на арену
            </Link>

            {/* Autoredirect hint */}
            {!cancelled ? (
              <div className="text-xs md:text-sm text-white/60">
                Автопереход через <span className="text-white/85 font-semibold">{Math.max(secondsLeft, 0)}</span> сек.{" "}
                <button
                  onClick={() => setCancelled(true)}
                  className="underline underline-offset-4 hover:text-white/85 transition"
                >
                  Отмена
                </button>
              </div>
            ) : (
              <div className="text-xs md:text-sm text-white/60">Автопереход отключён.</div>
            )}
          </div>

          {/* Small helper */}
          <div className="mt-10 text-[11px] md:text-xs text-white/45">
            Подсказка: чтобы заменить фон — положи своё видео в <span className="text-white/65">public/videos/cs2-bg.mp4</span>
          </div>
        </div>
      </div>

      {/* Global styles for smooth “wow” motion */}
      <style jsx global>{`
        .landingVideo {
          filter: blur(1.5px) saturate(1.05) contrast(1.05);
          transform: scale(1.03);
          animation: landingZoom 14s ease-in-out infinite alternate;
        }
        .landingVignette {
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.65) 68%, rgba(0,0,0,0.85) 100%);
        }
        .landingBtn {
          background: linear-gradient(135deg, rgba(220,38,38,0.95), rgba(234,88,12,0.92));
          border: 1px solid rgba(255,255,255,0.12);
          position: relative;
          overflow: hidden;
          transform: translateY(0);
          transition: transform 220ms ease, filter 220ms ease;
          animation: landingPop 900ms ease both, landingPulse 2.6s ease-in-out 900ms infinite;
        }
        .landingBtn:hover {
          transform: translateY(-2px) scale(1.01);
          filter: brightness(1.04);
        }
        .landingBtn:active {
          transform: translateY(0px) scale(0.99);
        }
        .landingBtn::before {
          content: "";
          position: absolute;
          inset: -40%;
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.22), rgba(255,255,255,0) 55%);
          transform: translateX(-35%) translateY(-20%) rotate(10deg);
          animation: landingSheen 4.2s ease-in-out infinite;
          pointer-events: none;
        }

        .landingGlow {
          background: radial-gradient(circle at 50% 50%, rgba(234,88,12,0.20), rgba(220,38,38,0.12), rgba(0,0,0,0));
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.08),
            0 25px 80px rgba(0,0,0,0.55),
            0 0 70px rgba(234,88,12,0.18);
        }
        .landingFloat {
          animation: landingFloat 3.6s ease-in-out infinite;
        }

        @keyframes landingPop {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0px) scale(1); }
        }
        @keyframes landingZoom {
          from { transform: scale(1.03); }
          to { transform: scale(1.08); }
        }
        @keyframes landingPulse {
          0%, 100% { box-shadow: 0 20px 60px rgba(0,0,0,0.55); }
          50% { box-shadow: 0 22px 78px rgba(0,0,0,0.62); }
        }
        @keyframes landingSheen {
          0% { transform: translateX(-55%) translateY(-20%) rotate(10deg); opacity: 0.0; }
          25% { opacity: 0.55; }
          50% { transform: translateX(45%) translateY(10%) rotate(10deg); opacity: 0.15; }
          100% { transform: translateX(55%) translateY(15%) rotate(10deg); opacity: 0.0; }
        }
        @keyframes landingFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </main>
  );
}
