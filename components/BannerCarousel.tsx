"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function BannerCarousel() {
  const router = useRouter();

  return (
    <div className="relative w-full overflow-hidden rounded-none">
      <button
        type="button"
        onClick={() => router.push("/register")}
        className="w-full text-left"
        aria-label="Open registration"
      >
        <Image
          src="/banners/hero_robinson.png"
          alt="Robinson — Start playing"
          width={1920}
          height={720}
          className="h-auto w-full object-cover"
          priority
        />
      </button>
    </div>
  );
}
