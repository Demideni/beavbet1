// app/page.tsx
import Link from "next/link";
import Image from "next/image";
import BannerCarousel from "@/components/BannerCarousel";

export default function HomePage() {
  return (
    <div className="space-y-4 pb-4">
      {/* 1. Большой верхний баннер (клик -> регистрация) */}
      <div className="mx-4 mt-2">
  <div className="overflow-hidden rounded-2xl border border-blue-400/20 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
    <img
      src="/banners/hero_robinson.png"
      alt="Robinson"
      className="w-full object-cover"
    />
  </div>
</div>


      {/* 2. Два промо-баннера под hero */}
      <section className="px-4">
        <div className="flex gap-3">
          {/* DEMO (без регистрации) */}
          <Link
            href="/go/robinson-demo"
            className="promo-neon flex-1"
          >
            <span className="promo-spark promo-spark--a" />
            <span className="promo-spark promo-spark--b" />
            <Image
              src="/banners/robinson_demo.png"
              alt="ROBINSON Demo"
              width={640}
              height={360}
              className="h-full w-full object-cover"
              priority
            />
          </Link>

          {/* PLAY (через регистрацию) */}
          <Link
            href="/go/robinson"
            className="promo-neon promo-neon--green flex-1"
          >
            <span className="promo-spark promo-spark--a" />
            <span className="promo-spark promo-spark--b" />
            <Image
              src="/banners/robinson_play.png"
              alt="Play ROBINSON"
              width={640}
              height={360}
              className="h-full w-full object-cover"
            />
          </Link>
        </div>
      </section>
    </div>
  );
}
