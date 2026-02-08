import Link from "next/link";

type OriginalGame = {
  key: string;
  label: string;
  href: string;
  bannerSrc: string;
};

// Add more originals by appending to this list.
// Banners should live in: /public/images/originals/
const ORIGINALS: OriginalGame[] = [
  {
    key: "robinson",
    label: "",
    href: "/casino/original/robinson",
    bannerSrc: "/images/originals/robinson.png",
  },
];

export function BeavbetOriginal() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold text-white/90">
          <span className="text-accent">BEAV</span>BET Original
        </div>
        <Link href="/casino/original" className="text-sm text-white/60 hover:text-white/90">
          Go to Casino
        </Link>
      </div>

      <div className="-mx-4 px-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-3 snap-x snap-mandatory">
          {ORIGINALS.map((g) => (
            <Link
              key={g.key}
              href={g.href}
              className="relative h-24 w-56 sm:h-28 sm:w-72 flex-none snap-start overflow-hidden rounded-3xl border border-white/10 bg-white/5 hover:bg-white/8 transition"
            >
              {/* banner background */}
              <div
                className="absolute inset-0 bg-center bg-cover"
                style={{ backgroundImage: `url(${g.bannerSrc})` }}
              />

              {/* centered label */}
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-base font-semibold text-white tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
                  {g.label}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
