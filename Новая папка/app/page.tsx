"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [seconds, setSeconds] = useState(9);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.push("/arena");
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/videos/cs2-bg.mp4" type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-5xl font-bold text-white mb-4">
          BeavBet Arena
        </h1>

        <p className="text-white/80 mb-8">
          CS2 • турниры • дуэли • BeavRank
        </p>

        <button
          onClick={() => router.push("/arena")}
          className="bg-red-600 hover:bg-red-700 transition px-8 py-4 rounded-xl text-white text-lg font-semibold"
        >
          Перейти на арену
        </button>

        <p className="text-white/60 mt-4 text-sm">
          Автопереход через {seconds} сек.
        </p>
      </div>
    </div>
  );
}