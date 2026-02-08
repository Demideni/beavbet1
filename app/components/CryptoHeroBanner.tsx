import Image from "next/image";
import Link from "next/link";
import { banners } from "@/app/content/banners";

/**
 * Reuses the same copy/art as the "BEAV LOVES CRYPTO" hero slide,
 * but renders it as a standalone banner section.
 */
export function CryptoHeroBanner() {
  const b = banners.find((x) => x.id === "crypto") ?? banners[0];

  return (
    <section className="w-full rounded-3xl overflow-hidden card-glass gradient-hero">
      <div className="relative min-h-[220px] sm:min-h-[240px]">
        <Image
          src={b.art}
          alt={b.title}
          fill
          className="object-cover opacity-90"
          priority={false}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg/55 via-transparent to-transparent" />

        <div className="relative z-10 p-5 sm:p-6 flex flex-col justify-between min-h-[220px] sm:min-h-[240px]">
          <div className="max-w-[560px]">
            <div className="text-accent font-extrabold tracking-tight text-3xl sm:text-4xl leading-none">
              {b.title}
            </div>
            <div className="mt-2 text-white font-extrabold tracking-tight text-3xl sm:text-4xl leading-none">
              {b.subtitle}
            </div>
            {b.note && <div className="mt-2 text-white/65 text-base">{b.note}</div>}

            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <Link
                href={b.href}
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-2xl btn-accent font-semibold"
              >
                {b.cta}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
