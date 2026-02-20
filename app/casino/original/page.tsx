import Link from "next/link";

const ORIGINALS = [
  {
    key: "robinson",
    title: "Robinson",
    href: "/casino/original/robinson",
    bannerSrc: "/images/originals/robinson.png",
  },

{
  key: "blackjack",
  title: "Blackjack",
  href: "/casino/original/blackjack",
  bannerSrc: "/images/originals/blackjack.png",
},


{
  key: "aviator",
  title: "BeavJet",
  href: "/casino/original/aviator",
  bannerSrc: "/images/originals/aviator.png",
},

];

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl card-glass p-6 sm:p-8">
        <div className="text-3xl font-extrabold">BEAVBET Original</div>
        <div className="mt-2 text-white/60">Наши собственные игры. Добавим больше позже.</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ORIGINALS.map((g) => (
          <Link
            key={g.key}
            href={g.href}
            className="relative h-36 overflow-hidden rounded-3xl border border-white/10 bg-white/5 hover:bg-white/8 transition"
          >
            <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${g.bannerSrc})` }} />
            <div className="absolute inset-0 bg-black/45 hover:bg-black/35 transition" />
            <div className="absolute inset-0 flex items-end justify-between p-4">
              <div className="text-lg font-bold text-white">{g.title}</div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">Play</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
